//! Bounded parallel worker pool for Soroban contract compilation jobs.
//!
//! The pool owns a fixed number of worker tasks (controlled by `COMPILE_MAX_WORKERS`,
//! default `min(num_cpus, 4)`).  Incoming `CompileJob` values are sent through an
//! `mpsc` channel whose capacity is `COMPILE_QUEUE_DEPTH` (default 32).  When that
//! channel is full, `WorkerPool::submit` returns `QueueFullError` and the handler
//! responds **503 Service Unavailable**.
//!
//! Each job carries:
//! - a `oneshot` sender for the final `CompileJobResult` (used by the synchronous
//!   `POST /compile` path which awaits the result inline), and
//! - a `broadcast` sender for `CompileProgress` events (used by the SSE streaming
//!   path `GET /compile/:job_id/progress`).
//!
//! When the SSE client disconnects before the job finishes, the worker detects the
//! broken `progress_tx` and kills the child process via `kill_on_drop(true)`.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    env,
    process::Stdio,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tempfile::Builder;
use tokio::{
    fs,
    process::Command,
    sync::{broadcast, mpsc, oneshot},
    time::timeout,
};
use tracing::{debug, warn};

// ─── Constants ────────────────────────────────────────────────────────────────

pub const COMPILE_TIMEOUT_SECS: u64 = 90;

pub const TEMPLATE_CARGO_TOML: &str = r#"[package]
name = "lumens_block_generated"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
"#;

// ─── Public types ─────────────────────────────────────────────────────────────

/// Progress events streamed to SSE subscribers.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CompileProgress {
    /// Job was accepted into the queue.  `position` is 1-based.
    Queued { position: usize },
    /// A worker picked up the job and `cargo build` is running.
    Building { elapsed_ms: u64 },
    /// Compilation finished successfully.
    Done,
    /// Compilation failed.
    Failed { code: String },
}

/// Final result delivered via the `oneshot` channel.
#[derive(Debug)]
pub enum CompileJobResult {
    Success {
        wasm: String,
        source_hash: String,
        size_bytes: usize,
    },
    Failure {
        code: String,
        message: String,
        details: Vec<String>,
    },
}

/// A single compilation request dispatched to the pool.
pub struct CompileJob {
    pub job_id: String,
    pub source: String,
    /// Pre-computed SHA-256 hex digest of `source` (first 8 bytes).
    pub source_hash: String,
    /// Delivers the final result to the caller of `POST /compile`.
    pub result_tx: oneshot::Sender<CompileJobResult>,
    /// Broadcasts progress events to any SSE subscribers.
    pub progress_tx: broadcast::Sender<CompileProgress>,
}

/// Returned by `WorkerPool::submit` when the queue channel is full.
#[derive(Debug)]
pub struct QueueFullError;

impl std::fmt::Display for QueueFullError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "compilation queue is full")
    }
}

// ─── WorkerPool ───────────────────────────────────────────────────────────────

/// Bounded compilation worker pool.
///
/// Create via `WorkerPool::from_env()` and share the `Arc<WorkerPool>` as
/// Axum application state.
pub struct WorkerPool {
    queue_tx: mpsc::Sender<CompileJob>,
    /// Count of jobs currently being executed (not queued).
    pub active: Arc<AtomicUsize>,
    pub max_workers: usize,
    pub queue_depth: usize,
}

impl WorkerPool {
    /// Spawn a new pool with explicit parameters.
    pub fn new(max_workers: usize, queue_depth: usize) -> Arc<Self> {
        let (queue_tx, queue_rx) = mpsc::channel::<CompileJob>(queue_depth);
        let active = Arc::new(AtomicUsize::new(0));

        let pool = Arc::new(WorkerPool {
            queue_tx,
            active: active.clone(),
            max_workers,
            queue_depth,
        });

        let active_clone = active.clone();
        tokio::spawn(run_dispatcher(queue_rx, max_workers, active_clone));

        pool
    }

    /// Build a pool from environment variables with sensible defaults.
    ///
    /// | Variable              | Default                    |
    /// |-----------------------|----------------------------|
    /// | `COMPILE_MAX_WORKERS` | `min(logical CPUs, 4)`     |
    /// | `COMPILE_QUEUE_DEPTH` | `32`                       |
    pub fn from_env() -> Arc<Self> {
        let cpus = num_cpus();
        let max_workers = env::var("COMPILE_MAX_WORKERS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or_else(|| cpus.min(4))
            .max(1);

        let queue_depth = env::var("COMPILE_QUEUE_DEPTH")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(32)
            .max(1);

        Self::new(max_workers, queue_depth)
    }

    /// Submit a job.  Returns `Err(QueueFullError)` if the queue is at capacity.
    pub async fn submit(&self, job: CompileJob) -> Result<(), QueueFullError> {
        self.queue_tx.try_send(job).map_err(|_| QueueFullError)
    }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/// Reads jobs from the queue and spawns one Tokio task per job, honouring the
/// `max_workers` concurrency limit via a semaphore.
async fn run_dispatcher(
    mut rx: mpsc::Receiver<CompileJob>,
    max_workers: usize,
    active: Arc<AtomicUsize>,
) {
    let semaphore = Arc::new(tokio::sync::Semaphore::new(max_workers));

    while let Some(job) = rx.recv().await {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let active = active.clone();

        tokio::spawn(async move {
            active.fetch_add(1, Ordering::SeqCst);
            execute_job(job).await;
            active.fetch_sub(1, Ordering::SeqCst);
            drop(permit);
        });
    }
}

// ─── Job execution ────────────────────────────────────────────────────────────

/// Runs a single compilation job.
///
/// Uses `kill_on_drop(true)` on the child process so that if this future is
/// dropped (e.g. the SSE stream is torn down mid-build) the OS-level `cargo`
/// process is also killed, preventing orphaned builds.
async fn execute_job(job: CompileJob) {
    let CompileJob {
        job_id,
        source,
        source_hash,
        result_tx,
        progress_tx,
    } = job;

    debug!(job_id = %job_id, "worker starting compilation");

    // ── Temp workspace setup ──────────────────────────────────────────────────
    let temp_dir = match Builder::new().prefix("soroban-build-").tempdir() {
        Ok(d) => d,
        Err(e) => {
            let _ = progress_tx.send(CompileProgress::Failed {
                code: "DIR_CREATE_FAILED".into(),
            });
            let _ = result_tx.send(CompileJobResult::Failure {
                code: "DIR_CREATE_FAILED".into(),
                message: format!("Failed to create temporary directory: {e}"),
                details: vec![],
            });
            return;
        }
    };

    let work_dir = temp_dir.path();
    let src_dir = work_dir.join("src");
    let target_dir = work_dir.join("target");

    macro_rules! bail {
        ($code:expr, $msg:expr, $details:expr) => {{
            let _ = progress_tx.send(CompileProgress::Failed {
                code: $code.to_string(),
            });
            let _ = result_tx.send(CompileJobResult::Failure {
                code: $code.to_string(),
                message: $msg.to_string(),
                details: $details,
            });
            return;
        }};
    }

    if let Err(e) = fs::create_dir_all(&src_dir).await {
        bail!("DIR_CREATE_FAILED", format!("Failed to create src dir: {e}"), vec![]);
    }

    if let Err(e) = fs::write(work_dir.join("Cargo.toml"), TEMPLATE_CARGO_TOML).await {
        bail!("WRITE_FAILED", format!("Failed to write Cargo.toml: {e}"), vec![]);
    }

    if let Err(e) = fs::write(src_dir.join("lib.rs"), &source).await {
        bail!("WRITE_FAILED", format!("Failed to write lib.rs: {e}"), vec![]);
    }

    let cargo_bin = env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());

    let mut cmd = Command::new(&cargo_bin);
    cmd.arg("build")
        .arg("--target")
        .arg("wasm32-unknown-unknown")
        .arg("--release")
        .current_dir(work_dir)
        .env("CARGO_TARGET_DIR", &target_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // Ensures the OS process is killed if the Tokio future is dropped
        // mid-build (e.g. SSE client disconnects).
        .kill_on_drop(true);

    let child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            bail!("EXEC_FAILED", format!("Failed to spawn cargo: {e}"), vec![]);
        }
    };

    let start = Instant::now();

    // ── Progress ticker ───────────────────────────────────────────────────────
    // Broadcasts Building{elapsed_ms} every second until the build ends or
    // the SSE client disconnects (receiver_count drops to 0).
    let ticker_tx = progress_tx.clone();
    let ticker = tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if ticker_tx.receiver_count() == 0 {
                break;
            }
            let elapsed_ms = start.elapsed().as_millis() as u64;
            if ticker_tx
                .send(CompileProgress::Building { elapsed_ms })
                .is_err()
            {
                break;
            }
        }
    });

    // ── Await cargo with timeout ──────────────────────────────────────────────
    let wait_result = timeout(
        Duration::from_secs(COMPILE_TIMEOUT_SECS),
        child.wait_with_output(),
    )
    .await;

    ticker.abort();

    // If no SSE receivers remain the client disconnected before the build
    // finished.  The child process is already handled by kill_on_drop(true).
    if progress_tx.receiver_count() == 0 {
        warn!(job_id = %job_id, "SSE client disconnected mid-build; cargo process cleaned up via kill_on_drop");
    }

    let output = match wait_result {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => {
            bail!("EXEC_FAILED", format!("cargo build error: {e}"), vec![]);
        }
        Err(_) => {
            bail!(
                "TIMEOUT",
                format!("Compilation timed out after {COMPILE_TIMEOUT_SECS}s"),
                vec![]
            );
        }
    };

    // ── Parse output ──────────────────────────────────────────────────────────
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let details: Vec<String> = format!("{stderr}\n{stdout}")
            .lines()
            .map(|l| l.to_string())
            .collect();

        let _ = progress_tx.send(CompileProgress::Failed {
            code: "COMPILATION_FAILED".into(),
        });
        let _ = result_tx.send(CompileJobResult::Failure {
            code: "COMPILATION_FAILED".into(),
            message: "Rust compilation failed.".into(),
            details,
        });
        return;
    }

    let wasm_path = target_dir
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("lumens_block_generated.wasm");

    let wasm_bytes = match fs::read(&wasm_path).await {
        Ok(b) => b,
        Err(e) => {
            bail!("WASM_READ_FAILED", format!("Failed to read WASM: {e}"), vec![]);
        }
    };

    let wasm_b64 = BASE64.encode(&wasm_bytes);
    let size_bytes = wasm_bytes.len();

    let _ = progress_tx.send(CompileProgress::Done);
    let _ = result_tx.send(CompileJobResult::Success {
        wasm: wasm_b64,
        source_hash,
        size_bytes,
    });

    debug!(job_id = %job_id, size_bytes, "compilation complete");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/// Returns the number of logical CPUs, defaulting to 1 on error.
fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

/// Compute the 8-byte hex source hash used in `CompileResponse`.
pub fn compute_source_hash(source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8])
}
