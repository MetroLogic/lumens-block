use axum::{http::StatusCode, Json};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{env, process::Stdio, time::Duration};
use tempfile::Builder;
use tokio::{fs, process::Command, time::timeout};

const MAX_SOURCE_LEN: usize = 1_000_000; // 1 MB
const COMPILE_TIMEOUT_SECS: u64 = 90;

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

pub async fn compile(
    Json(req): Json<CompileRequest>,
) -> Result<Json<CompileResponse>, (StatusCode, Json<CompileErrorResponse>)> {
    if req.source.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "INVALID_PAYLOAD".into(),
                    message: "Rust source code cannot be empty.".into(),
                    details: None,
                },
            }),
        ));
    }

    if req.source.len() > MAX_SOURCE_LEN {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "PAYLOAD_TOO_LARGE".into(),
                    message: format!("Source code exceeds maximum allowed size of {MAX_SOURCE_LEN} bytes."),
                    details: None,
                },
            }),
        ));
    }

    // Create temporary workspace directory
    let temp_dir = Builder::new().prefix("soroban-build-").tempdir().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "DIR_CREATE_FAILED".into(),
                    message: format!("Failed to create temporary build directory: {e}"),
                    details: None,
                },
            }),
        )
    })?;

    let work_dir = temp_dir.path();
    let src_dir = work_dir.join("src");
    let target_dir = work_dir.join("target");

    fs::create_dir_all(&src_dir).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "DIR_CREATE_FAILED".into(),
                    message: format!("Failed to create src directory: {e}"),
                    details: None,
                },
            }),
        )
    })?;

    fs::write(work_dir.join("Cargo.toml"), TEMPLATE_CARGO_TOML)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileErrorResponse {
                    error: CompileErrorDetail {
                        code: "WRITE_FAILED".into(),
                        message: format!("Failed to write Cargo.toml: {e}"),
                        details: None,
                    },
                }),
            )
        })?;

    fs::write(src_dir.join("lib.rs"), &req.source)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileErrorResponse {
                    error: CompileErrorDetail {
                        code: "WRITE_FAILED".into(),
                        message: format!("Failed to write lib.rs: {e}"),
                        details: None,
                    },
                }),
            )
        })?;

    let cargo_bin = env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());

    let mut cmd = Command::new(cargo_bin);
    cmd.arg("build")
        .arg("--target")
        .arg("wasm32-unknown-unknown")
        .arg("--release")
        .current_dir(work_dir)
        .env("CARGO_TARGET_DIR", &target_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let compile_task = cmd.output();
    let output = match timeout(Duration::from_secs(COMPILE_TIMEOUT_SECS), compile_task).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileErrorResponse {
                    error: CompileErrorDetail {
                        code: "EXEC_FAILED".into(),
                        message: format!("Failed to execute cargo build: {e}"),
                        details: None,
                    },
                }),
            ));
        }
        Err(_) => {
            return Err((
                StatusCode::GATEWAY_TIMEOUT,
                Json(CompileErrorResponse {
                    error: CompileErrorDetail {
                        code: "TIMEOUT".into(),
                        message: format!("Compilation timed out after {COMPILE_TIMEOUT_SECS} seconds."),
                        details: None,
                    },
                }),
            ));
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{stderr}\n{stdout}");

        let details = combined
            .lines()
            .map(|l| l.to_string())
            .collect::<Vec<String>>();

        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "COMPILATION_FAILED".into(),
                    message: "Rust compilation failed.".into(),
                    details: Some(details),
                },
            }),
        ));
    }

    let wasm_path = target_dir
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("lumens_block_generated.wasm");

    if !wasm_path.exists() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "WASM_NOT_FOUND".into(),
                    message: "Compilation succeeded but target WASM file was not found.".into(),
                    details: None,
                },
            }),
        ));
    }

    let wasm_bytes = fs::read(&wasm_path).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CompileErrorResponse {
                error: CompileErrorDetail {
                    code: "WASM_READ_FAILED".into(),
                    message: format!("Failed to read generated WASM binary: {e}"),
                    details: None,
                },
            }),
        )
    })?;

    let mut hasher = Sha256::new();
    hasher.update(req.source.as_bytes());
    let hash_result = hasher.finalize();
    let source_hash = hex::encode(&hash_result[..8]);

    let wasm_base64 = BASE64.encode(&wasm_bytes);
    let size_bytes = wasm_bytes.len();

    Ok(Json(CompileResponse {
        wasm: wasm_base64,
        source_hash,
        size_bytes,
    }))
}
