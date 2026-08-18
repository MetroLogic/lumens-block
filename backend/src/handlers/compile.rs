use axum::{http::StatusCode, Json};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs;
use tokio::process::Command;
use tokio::time::timeout;
use uuid::Uuid;

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

fn err(
    status: StatusCode,
    code: &str,
    message: String,
) -> (StatusCode, Json<CompileErrorResponse>) {
    (
        status,
        Json(CompileErrorResponse {
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
) -> (StatusCode, Json<CompileErrorResponse>) {
    (
        status,
        Json(CompileErrorResponse {
            error: CompileErrorDetail {
                code: code.into(),
                message,
                details: Some(details),
            },
        }),
    )
}

fn validate_source(source: &str) -> Result<(), (StatusCode, Json<CompileErrorResponse>)> {
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

const TEMPLATE_CARGO_TOML: &str = r#"[package]
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

fn set_resource_limits(cmd: &mut Command) {
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::process::CommandExt;

        let cpu_secs = compile_cpu_secs();
        let mem_bytes = compile_mem_mb() * 1024 * 1024;

        unsafe {
            cmd.as_std_mut().pre_exec(move || {
                use nix::sys::resource::{setrlimit, Resource};
                let _ = setrlimit(Resource::RLIMIT_CPU, cpu_secs, cpu_secs);
                let _ = setrlimit(Resource::RLIMIT_AS, mem_bytes, mem_bytes);
                Ok(())
            });
        }
    }
}

pub async fn compile(
    Json(req): Json<CompileRequest>,
) -> Result<Json<CompileResponse>, (StatusCode, Json<CompileErrorResponse>)> {
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
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

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

    let wasm_bytes = fs::read(&wasm_path).await.map_err(|e| {
        err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "WASM_READ_FAILED",
            format!("Failed to read generated WASM binary: {e}"),
        )
    })?;

    let mut hasher = Sha256::new();
    hasher.update(req.source.as_bytes());
    let hash_result = hasher.finalize();
    let source_hash = hex::encode(&hash_result[..8]);

    let wasm_base64 = BASE64.encode(&wasm_bytes);
    let size_bytes = wasm_bytes.len();

    cleanup_dir(&work_dir).await;

    Ok(Json(CompileResponse {
        wasm: wasm_base64,
        source_hash,
        size_bytes,
    }))
}

async fn cleanup_dir(path: &std::path::Path) {
    let _ = fs::remove_dir_all(path).await;
}
