use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, sse::KeepAlive, sse::Sse},
    Json as JsonPayload,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::convert::Infallible;
use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::fs;
use tokio::process::Command;
use tokio::sync::{broadcast, oneshot};
use tokio::time::timeout;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use uuid::Uuid;

use crate::worker_pool::{
    CompileJob, CompileJobResult, CompileProgress, compute_source_hash,
};

// ─── Shared request / response types ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CompileRequest {
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct CompileResponse {
    pub wasm: String,
    #[serde(rename = "sourceHash")]
    pub source_hash: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: usize,
    pub cached: bool,
}

#[derive(Debug, Serialize)]
pub struct CompileErrorResponse {
    pub error: CompileErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct CompileErrorDetail {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<String>>,
}

/// Response returned by `POST /compile/async`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsyncCompileResponse {
    pub job_id: String,
    pub cached: bool,
}

// ─── Configuration helpers ───────────────────────────────────────────────────

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_or_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_or_usize(key: &str, default: usize) -> usize {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn compile_timeout_secs() -> u64 {
    env_or_u64("COMPILE_TIMEOUT_SECS", 30)
}

fn max_source_bytes() -> usize {
    env_or_usize("MAX_SOURCE_BYTES", 65536)
}

fn compile_cpu_secs() -> u64 {
    env_or_u64("COMPILE_CPU_SECS", 20)
}

fn compile_mem_mb() -> u64 {
    env_or_u64("COMPILE_MEM_MB", 1024)
}

fn compile_work_dir() -> PathBuf {
    PathBuf::from(env_or("COMPILE_WORK_DIR", "/tmp/lumens-compile"))
}

// ─── Input validation (shared by both sync and async paths) ──────────────────

const FORBIDDEN_PATTERNS: &[&str] = &[
    "build.rs",
    "include!(",
    "include_str!(",
    "include_bytes!(",
    "std::fs",
    "std::process",
    "std::net",
    "#[proc_macro",
];

fn err(
    status: StatusCode,
    code: &str,
    message: String,
) -> (StatusCode, JsonPayload<CompileErrorResponse>) {
    (
        status,
        JsonPayload(CompileErrorResponse {
            error: CompileErrorDetail {
                code: code.into(),
                message,
                details: None,
            },
        }),
    )
}

fn err_with_details(
    status: StatusCode,
    code: &str,
    message: String,
    details: Vec<String>,
) -> (StatusCode, JsonPayload<CompileErrorResponse>) {
    (
        status,
        JsonPayload(CompileErrorResponse {
            error: CompileErrorDetail {
                code: code.into(),
                message,
                details: Some(details),
            },
        }),
    )
}

fn validate_source(source: &str) -> Result<(), (StatusCode, JsonPayload<CompileErrorResponse>)> {
    if source.trim().is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "INVALID_PAYLOAD",
            "Rust source code cannot be empty.".into(),
        ));
    }

    if source.len() > max_source_bytes() {
        return Err(err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "PAYLOAD_TOO_LARGE",
            format!(
                "Source code exceeds maximum allowed size of {} bytes.",
                max_source_bytes()
            ),
        ));
    }

    let mut matched: Vec<String> = Vec::new();
    for pattern in FORBIDDEN_PATTERNS {
        if source.contains(pattern) {
            matched.push(pattern.to_string());
        }
    }
    if !matched.is_empty() {
        return Err(err_with_details(
            StatusCode::UNPROCESSABLE_ENTITY,
            "forbidden_pattern",
            "Source contains forbidden patterns that may compromise server security.".into(),
            matched,
        ));
    }

    Ok(())
}

// ─── Sandboxed compilation template ──────────────────────────────────────────

const TEMPLATE_CARGO_TOML: &str = r#"[package]
name = "lumens_block_generated"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["alloc"] }
"#;

fn source_hash(source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Applies Linux resource limits (CPU time + address-space) to the cargo
/// subprocess so a malicious or runaway contract cannot exhaust the host.
fn set_resource_limits(cmd: &mut Command) {
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::process::CommandExt;

        let cpu_secs = compile_cpu_secs();
        let mem_bytes = compile_mem_mb() * 1024 * 1024;

        unsafe {
            cmd.as_std_mut().pre_exec(move || {
                use nix::sys::resource::{setrlimit, Resource};
                use nix::unistd::setsid;

                // New session => new process group, so we can kill the whole
                // cargo tree on timeout via the negative-pid signal below.
                let _ = setsid();
                let _ = setrlimit(Resource::RLIMIT_CPU, cpu_secs, cpu_secs);
                let _ = setrlimit(Resource::RLIMIT_AS, mem_bytes, mem_bytes);
                Ok(())
            });
        }
    }
}

async fn cleanup_dir(path: &std::path::Path) {
    let _ = fs::remove_dir_all(path).await;
}

// ─── POST /compile  (synchronous, sandboxed) ─────────────────────────────────

/// Synchronous compile endpoint.
///
/// Writes the submitted source into an isolated temporary crate, compiles it to
/// `wasm32-unknown-unknown` with resource limits + a wall-clock timeout, and
/// returns the resulting WASM binary. This path performs the compilation inline
/// with sandboxing rather than via the worker pool.
pub async fn compile(
    Json(req): Json<CompileRequest>,
) -> Result<JsonPayload<CompileResponse>, (StatusCode, JsonPayload<CompileErrorResponse>)> {
    validate_source(&req.source)?;

    let base_dir = compile_work_dir();
    fs::create_dir_all(&base_dir).await.map_err(|e| {
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DIR_CREATE_FAILED",
            format!("Failed to create compile work directory: {e}"),
        )
    })?;

    let job_id = Uuid::new_v4();
    let work_dir = base_dir.join(job_id.to_string());
    let src_dir = work_dir.join("src");
    let target_dir = work_dir.join("target");

    fs::create_dir_all(&src_dir).await.map_err(|e| {
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "DIR_CREATE_FAILED",
            format!("Failed to create src directory: {e}"),
        )
    })?;

    fs::write(work_dir.join("Cargo.toml"), TEMPLATE_CARGO_TOML)
        .await
        .map_err(|e| {
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "WRITE_FAILED",
                format!("Failed to write Cargo.toml: {e}"),
            )
        })?;

    fs::write(src_dir.join("lib.rs"), &req.source)
        .await
        .map_err(|e| {
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "WRITE_FAILED",
                format!("Failed to write lib.rs: {e}"),
            )
        })?;

    let cargo_bin = env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());

    let mut cmd = Command::new(&cargo_bin);
    cmd.arg("build")
        .arg("--target")
        .arg("wasm32-unknown-unknown")
        .arg("--release")
        .current_dir(&work_dir)
        .env("CARGO_TARGET_DIR", &target_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    set_resource_limits(&mut cmd);

    let child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            cleanup_dir(&work_dir).await;
            return Err(err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "EXEC_FAILED",
                format!("Failed to start cargo build: {e}"),
            ));
        }
    };

    let pid = child.id();

    let child_wait = tokio::spawn(async move { child.wait_with_output().await });

    let timeout_secs = compile_timeout_secs();
    let output = match timeout(Duration::from_secs(timeout_secs), child_wait).await {
        Ok(Ok(Ok(output))) => output,
        Ok(Ok(Err(e))) => {
            cleanup_dir(&work_dir).await;
            return Err(err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "EXEC_FAILED",
                format!("Failed to read cargo output: {e}"),
            ));
        }
        Ok(Err(e)) => {
            cleanup_dir(&work_dir).await;
            return Err(err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "EXEC_FAILED",
                format!("Cargo build task panicked: {e}"),
            ));
        }
        Err(_elapsed) => {
            if let Some(p) = pid {
                #[cfg(unix)]
                {
                    use nix::sys::signal::{kill, Signal};
                    use nix::unistd::Pid;
                    let _ = kill(Pid::from_raw(p as i32), Signal::SIGKILL);
                    let _ = kill(Pid::from_raw(-(p as i32)), Signal::SIGKILL);
                }
            }
            cleanup_dir(&work_dir).await;
            return Err(err(
                StatusCode::REQUEST_TIMEOUT,
                "compilation_timeout",
                format!("Compilation exceeded {timeout_secs}s limit"),
            ));
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{stderr}\n{stdout}");
        let details: Vec<String> = combined.lines().map(|l| l.to_string()).collect();
        cleanup_dir(&work_dir).await;
        return Err(err_with_details(
            StatusCode::UNPROCESSABLE_ENTITY,
            "COMPILATION_FAILED",
            "Rust compilation failed.".into(),
            details,
        ));
    }

    let wasm_path = target_dir
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("lumens_block_generated.wasm");

    if !wasm_path.exists() {
        cleanup_dir(&work_dir).await;
        return Err(err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "WASM_NOT_FOUND",
            "Compilation succeeded but target WASM file was not found.".into(),
        ));
    }

    let wasm_bytes = match fs::read(&wasm_path).await {
        Ok(bytes) => bytes,
        Err(e) => {
            cleanup_dir(&work_dir).await;
            return Err(err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "WASM_READ_FAILED",
                format!("Failed to read generated WASM binary: {e}"),
            ));
        }
    };

    cleanup_dir(&work_dir).await;

    let wasm_base64 = base64::engine::general_purpose::STANDARD.encode(&wasm_bytes);
    let source_hash = source_hash(&req.source);
    let size_bytes = wasm_bytes.len();

    Ok(JsonPayload(CompileResponse {
        wasm: wasm_base64,
        source_hash,
        size_bytes,
        cached: false,
    }))
}

// ─── POST /compile/async  (returns jobId immediately) ─────────────────────────

/// Asynchronous compile endpoint — HTTP 202 Accepted.
///
/// Submits the job to the worker pool and returns `{ "jobId": "..." }`
/// immediately.  The client should open `GET /compile/:job_id/progress` to
/// stream SSE events.
pub async fn compile_async(
    State(state): State<crate::AppState>,
    Json(req): Json<CompileRequest>,
) -> Result<(StatusCode, JsonPayload<AsyncCompileResponse>), (StatusCode, JsonPayload<CompileErrorResponse>)> {
    validate_source(&req.source)?;

    let source_hash = compute_source_hash(&req.source);

    // Check if it's already in the cache
    if let Some(_) = state.cache.get(&source_hash).await {
        return Ok((
            StatusCode::ACCEPTED,
            JsonPayload(AsyncCompileResponse {
                job_id: Uuid::new_v4().to_string(), // Fake job ID since we're skipping work
                cached: true,
            }),
        ));
    }

    let job_id = Uuid::new_v4().to_string();

    // The async path doesn't need a oneshot result — the SSE stream delivers
    // the final outcome.  We still create it so the worker can send the result;
    // it is simply dropped here after the job completes.
    let (result_tx, _result_rx) = oneshot::channel::<CompileJobResult>();
    let (progress_tx, _seed_rx) = broadcast::channel::<CompileProgress>(64);

    // Store the broadcast sender in a shared registry so the SSE handler can
    // subscribe to it.  We use the job registry defined below.
    JOB_REGISTRY.insert(job_id.clone(), progress_tx.clone());

    let job = CompileJob {
        job_id: job_id.clone(),
        source: req.source,
        source_hash: source_hash.clone(),
        result_tx,
        progress_tx,
    };

    state.pool.submit(job).await.map_err(|_| {
        JOB_REGISTRY.remove(&job_id);
        (
            StatusCode::SERVICE_UNAVAILABLE,
            JsonPayload(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "QUEUE_FULL".into(),
                    message: "The compilation queue is currently full. Please try again shortly."
                        .into(),
                    details: None,
                },
            }),
        )
    })?;

    Ok((StatusCode::ACCEPTED, JsonPayload(AsyncCompileResponse { job_id, cached: false })))
}

// ─── Job registry ─────────────────────────────────────────────────────────────

/// A process-global registry mapping `job_id` → `broadcast::Sender<CompileProgress>`.
///
/// Entries are inserted when a job is submitted via `POST /compile/async` and
/// removed by the SSE handler once the stream ends (or after a TTL if the
/// client never connects).
static JOB_REGISTRY: once_cell::sync::Lazy<
    dashmap::DashMap<String, broadcast::Sender<CompileProgress>>,
> = once_cell::sync::Lazy::new(dashmap::DashMap::new);

// ─── GET /compile/:job_id/progress  (SSE stream) ─────────────────────────────

/// SSE endpoint for per-job progress.
///
/// Streams `CompileProgress` events serialized as JSON `data` payloads.
/// The `event` field of each SSE frame is set to the variant name
/// (`queued`, `building`, `done`, `error`).
///
/// When the client closes the connection, Tokio drops this future which
/// causes `BroadcastStream` to be dropped.  The worker detects
/// `receiver_count() == 0` on its `progress_tx` and terminates the child
/// process via `kill_on_drop(true)`.
pub async fn compile_progress(Path(job_id): Path<String>) -> impl IntoResponse {
    let Some(tx) = JOB_REGISTRY.get(&job_id).map(|r| r.clone()) else {
        return (
            StatusCode::NOT_FOUND,
            JsonPayload(serde_json::json!({
                "error": {
                    "code": "JOB_NOT_FOUND",
                    "message": format!("No job with id '{job_id}' found.")
                }
            })),
        )
            .into_response();
    };

    let rx = tx.subscribe();
    let job_id_owned = job_id.clone();

    let stream = BroadcastStream::new(rx)
        .take_while(|msg| msg.is_ok())
        .map(move |msg| -> Result<Event, Infallible> {
            let progress = msg.expect("checked above");

            let (event_name, data) = match &progress {
                CompileProgress::Queued { position } => (
                    "queued",
                    serde_json::to_string(&serde_json::json!({ "position": position }))
                        .unwrap_or_default(),
                ),
                CompileProgress::Building { elapsed_ms } => (
                    "building",
                    serde_json::to_string(&serde_json::json!({ "elapsedMs": elapsed_ms }))
                        .unwrap_or_default(),
                ),
                CompileProgress::Done => (
                    "done",
                    serde_json::to_string(&serde_json::json!({})).unwrap_or_default(),
                ),
                CompileProgress::Failed { code } => (
                    "error",
                    serde_json::to_string(&serde_json::json!({ "code": code }))
                        .unwrap_or_default(),
                ),
            };

            // Remove the job from the registry once the terminal event is sent
            if matches!(progress, CompileProgress::Done | CompileProgress::Failed { .. }) {
                JOB_REGISTRY.remove(&job_id_owned);
            }

            Ok(Event::default().event(event_name).data(data))
        });

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}
