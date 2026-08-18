use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use base64::Engine;
use http_body_util::BodyExt;
use lumens_block_backend::create_app;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tower::ServiceExt;

// Compile tests mutate process-global env vars (timeouts, work dir) that the
// handler reads. Serialize them so concurrent tests cannot clobber each other's
// configuration and produce flaky results.
static COMPILE_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json, json!({ "status": "ok" }));
}

#[tokio::test]
async fn test_compile_empty_payload() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": "" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "INVALID_PAYLOAD");
}

#[tokio::test]
async fn test_deploy_missing_payload() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/deploy")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "MISSING_SIGNED_XDR");
}

#[tokio::test]
async fn test_deploy_mock_wasm() {
    let app = create_app();

    let fake_wasm_b64 = base64::engine::general_purpose::STANDARD.encode(b"AGBwasm_mock_binary");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/deploy")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "wasm": fake_wasm_b64, "network": "testnet" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json["contractId"].as_str().unwrap().starts_with('C'));
    assert_eq!(json["status"], "MOCK_SUCCESS");
}

#[tokio::test]
async fn test_compile_valid_contract() {
    // Use generous, deterministic limits and an isolated work dir so the test
    // does not depend on CI machine speed or race with parallel tests.
    let _guard = COMPILE_LOCK.lock().await;
    std::env::set_var("COMPILE_TIMEOUT_SECS", "180");
    std::env::set_var("COMPILE_CPU_SECS", "120");
    std::env::set_var("COMPILE_MEM_MB", "4096");
    std::env::set_var("COMPILE_WORK_DIR", "/tmp/lumens-compile-valid-test");

    let app = create_app();

    let valid_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct TestContract;

#[contractimpl]
impl TestContract {
    pub fn hello(env: Env) -> u32 {
        42
    }
}
"#;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": valid_source }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json["wasm"].is_string());
    assert!(json["sourceHash"].is_string());
    assert!(json["sizeBytes"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn test_compile_forbidden_include() {
    let app = create_app();

    let malicious_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct BadContract;

#[contractimpl]
impl BadContract {
    pub fn hello(env: Env) -> u32 {
        let _ = include!("secret.txt");
        42
    }
}
"#;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "source": malicious_source }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "forbidden_pattern");
    let details = json["error"]["details"].as_array().unwrap();
    assert!(details.iter().any(|d| d.as_str() == Some("include!(")));
}

#[tokio::test]
async fn test_compile_forbidden_std_fs() {
    let app = create_app();

    let malicious_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct BadContract;

#[contractimpl]
impl BadContract {
    pub fn hello(env: Env) -> u32 {
        let _ = std::fs::read_dir("/etc");
        42
    }
}
"#;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "source": malicious_source }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "forbidden_pattern");
}

#[tokio::test]
async fn test_compile_forbidden_build_rs() {
    let app = create_app();

    let malicious_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct BadContract;

#[contractimpl]
impl BadContract {
    pub fn hello(env: Env) -> u32 {
        42
    }
}

// malicious: build.rs
"#;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "source": malicious_source }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "forbidden_pattern");
    let details = json["error"]["details"].as_array().unwrap();
    assert!(details.iter().any(|d| d.as_str() == Some("build.rs")));
}

#[tokio::test]
async fn test_compile_forbidden_proc_macro() {
    let app = create_app();

    let malicious_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct BadContract;

#[proc_macro]
pub fn hello(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    input
}
"#;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({ "source": malicious_source }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "forbidden_pattern");
    let details = json["error"]["details"].as_array().unwrap();
    assert!(details.iter().any(|d| d.as_str() == Some("#[proc_macro")));
}

#[tokio::test]
async fn test_compile_source_too_large() {
    let app = create_app();

    let huge_source = format!("fn main() {{ {} }}", "x".repeat(70000));

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": huge_source }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "PAYLOAD_TOO_LARGE");
}

#[tokio::test]
async fn test_compile_cleanup_on_failure() {
    use std::fs;

    // Isolate this test in its own work dir and use generous limits so a
    // parallel compile cannot leave a stray job directory that confuses the
    // before/after count.
    let _guard = COMPILE_LOCK.lock().await;
    let work_dir = "/tmp/lumens-compile-cleanup-test";
    std::env::set_var("COMPILE_WORK_DIR", work_dir);
    std::env::set_var("COMPILE_TIMEOUT_SECS", "180");
    std::env::set_var("COMPILE_CPU_SECS", "120");
    std::env::set_var("COMPILE_MEM_MB", "4096");
    let _ = fs::create_dir_all(work_dir);

    let app = create_app();

    let bad_source = r#"fn not_a_real_soroban_contract() { this_does_not_compile }"#;

    let count_jobs = || -> usize {
        fs::read_dir(work_dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .count()
            })
            .unwrap_or(0)
    };

    let before = count_jobs();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": bad_source }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_ne!(response.status(), StatusCode::OK);

    let after = count_jobs();

    assert_eq!(
        before, after,
        "Temp directories should be cleaned up after failed compilation"
    );
}

#[tokio::test]
async fn test_compile_timeout() {
    // Use a tiny timeout and the (slow-to-build) valid contract source so the
    // cargo subprocess cannot possibly finish in time. The handler must kill
    // the child process group and return HTTP 408.
    let _guard = COMPILE_LOCK.lock().await;
    std::env::set_var("COMPILE_TIMEOUT_SECS", "2");
    std::env::set_var("COMPILE_CPU_SECS", "120");
    std::env::set_var("COMPILE_MEM_MB", "4096");
    std::env::set_var("COMPILE_WORK_DIR", "/tmp/lumens-compile-timeout-test");

    let app = create_app();

    let valid_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct TestContract;

#[contractimpl]
impl TestContract {
    pub fn hello(env: Env) -> u32 {
        42
    }
}
"#;

    let start = std::time::Instant::now();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": valid_source }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let elapsed = start.elapsed();

    assert_eq!(response.status(), StatusCode::REQUEST_TIMEOUT);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "compilation_timeout");

    // Must return within COMPILE_TIMEOUT_SECS + 2 seconds.
    assert!(
        elapsed <= std::time::Duration::from_secs(4),
        "timeout response took too long: {elapsed:?}"
    );
}
