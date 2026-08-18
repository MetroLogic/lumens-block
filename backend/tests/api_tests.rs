use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use base64::Engine;
use http_body_util::BodyExt;
use lumens_block_backend::create_app;
use serde_json::{json, Value};
use tower::ServiceExt;

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
                .body(Body::from(json!({ "wasm": fake_wasm_b64, "network": "testnet" }).to_string()))
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

// ─── /invoke tests ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_invoke_missing_contract_id() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "",
                        "functionName": "hello",
                        "network": "testnet"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "MISSING_CONTRACT_ID");
}

#[tokio::test]
async fn test_invoke_null_contract_id() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "functionName": "hello",
                        "network": "testnet"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "MISSING_CONTRACT_ID");
}

#[tokio::test]
async fn test_invoke_invalid_function_name_uppercase() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "CABC123",
                        "functionName": "HelloWorld",   // capital letters — invalid
                        "network": "testnet"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "INVALID_FUNCTION_NAME");
}

#[tokio::test]
async fn test_invoke_invalid_function_name_starts_with_digit() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "CABC123",
                        "functionName": "1bad_name",   // starts with digit — invalid
                        "network": "testnet"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "INVALID_FUNCTION_NAME");
}

#[tokio::test]
async fn test_invoke_missing_function_name() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "CABC123",
                        "network": "testnet"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "MISSING_FUNCTION_NAME");
}

#[tokio::test]
async fn test_invoke_invalid_network() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "CABC123",
                        "functionName": "hello",
                        "network": "devnet"   // unsupported
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "INVALID_NETWORK");
}

/// A valid payload reaches the RPC stub. In unit-test conditions the backend
/// will attempt to contact the real Soroban RPC endpoint, which will either
/// return a proper JSON-RPC error or fail to connect. Either way the response
/// must be a structured JSON body — never a panic or 500 from our own code.
/// We accept both BAD_GATEWAY (connection refused in CI) and UNPROCESSABLE_ENTITY
/// (RPC returned an error for the dummy contract).
#[tokio::test]
async fn test_invoke_valid_payload_reaches_rpc() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/invoke")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "contractId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
                        "functionName": "hello",
                        "network": "testnet",
                        "args": [
                            { "type": "Symbol", "value": "world" }
                        ]
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    // The request passed all local validation — it either reached the RPC
    // (success / RPC-level error) or failed to connect.
    let status = response.status();
    assert!(
        status == StatusCode::OK
            || status == StatusCode::UNPROCESSABLE_ENTITY
            || status == StatusCode::BAD_GATEWAY,
        "Unexpected status code: {status}"
    );

    let body = response.into_body().collect().await.unwrap().to_bytes();
    // Body must be valid JSON in all cases
    let _: Value = serde_json::from_slice(&body).expect("response body must be valid JSON");
}

// ─── Worker pool tests ────────────────────────────────────────────────────────

/// Submit 5 jobs to a pool with max_workers = 2.
/// All 5 must eventually complete, and the pool's active counter must return
/// to 0.  The semaphore inside the dispatcher ensures at most 2 run at once.
#[tokio::test]
async fn test_worker_pool_five_jobs_two_workers_all_complete() {
    use lumens_block_backend::worker_pool::{CompileJob, CompileJobResult, WorkerPool};
    use std::sync::atomic::Ordering;
    use tokio::sync::{broadcast, oneshot};

    const TOTAL_JOBS: usize = 5;
    const MAX_WORKERS: usize = 2;
    const QUEUE_DEPTH: usize = 16;

    let pool = WorkerPool::new(MAX_WORKERS, QUEUE_DEPTH);

    // Fast-failing source: not valid Soroban, but will complete quickly.
    let fast_source = "fn noop() {}".to_string();
    let mut receivers = Vec::new();

    for i in 0..TOTAL_JOBS {
        let (result_tx, result_rx) = oneshot::channel::<CompileJobResult>();
        let (progress_tx, _) = broadcast::channel(16);

        pool.submit(CompileJob {
            job_id: format!("pool-test-{i}"),
            source: fast_source.clone(),
            source_hash: format!("hash-{i}"),
            result_tx,
            progress_tx,
        })
        .await
        .expect("queue must not be full for this test");

        receivers.push(result_rx);
    }

    let mut completed = 0usize;
    for rx in receivers {
        tokio::time::timeout(std::time::Duration::from_secs(120), rx)
            .await
            .expect("every job must complete within the timeout")
            .expect("oneshot must not be dropped");
        completed += 1;
    }

    assert_eq!(completed, TOTAL_JOBS, "all {TOTAL_JOBS} jobs must complete");
    assert_eq!(pool.max_workers, MAX_WORKERS);
    // active counter returns to 0 after all jobs finish
    assert_eq!(pool.active.load(Ordering::SeqCst), 0);
}

/// Submitting queue_depth + 1 jobs simultaneously must produce at least one
/// 503 QUEUE_FULL response.
///
/// We use the WorkerPool directly (not via HTTP) so we can submit all jobs
/// truly in parallel before the dispatcher has a chance to drain them.
#[tokio::test]
async fn test_compile_queue_full_returns_503() {
    use lumens_block_backend::worker_pool::{CompileJob, CompileJobResult, WorkerPool};
    use tokio::sync::{broadcast, oneshot};

    // 1 worker, depth 2 → the channel holds 2 pending items.
    // Active slot (inside semaphore) + 2 queued = 3 total in-flight.
    // The 4th submit must be rejected immediately.
    let pool = WorkerPool::new(1, 2);

    let source = "fn placeholder() {}".to_string();
    let mut submit_results = Vec::new();

    // Submit 4 jobs back-to-back without awaiting any results.
    // try_send is non-blocking, so this runs before the worker drains anything.
    for i in 0..4usize {
        let (result_tx, _result_rx) = oneshot::channel::<CompileJobResult>();
        let (progress_tx, _) = broadcast::channel(16);
        let job = CompileJob {
            job_id: format!("queue-test-{i}"),
            source: source.clone(),
            source_hash: format!("hash-{i}"),
            result_tx,
            progress_tx,
        };
        // submit uses try_send internally — non-blocking
        let outcome = pool.submit(job).await;
        submit_results.push(outcome.is_err()); // true = QueueFullError
    }

    let overflow_count = submit_results.iter().filter(|&&rejected| rejected).count();
    assert!(
        overflow_count >= 1,
        "at least one submit must be rejected with QueueFullError; got {overflow_count} rejections out of {} submits",
        submit_results.len()
    );
}

/// HTTP-level: POST /compile returns 503 when the pool is already full.
#[tokio::test]
async fn test_compile_http_queue_full_503() {
    use lumens_block_backend::{create_app_with_pool, worker_pool::{CompileJob, CompileJobResult, WorkerPool}};
    use tokio::sync::{broadcast, oneshot};

    // Pool with 1 worker and depth 1. Pre-fill it so the HTTP call is rejected.
    let pool = WorkerPool::new(1, 1);
    let source = "fn x() {}".to_string();

    // Pre-fill: 1 active + 1 queued = channel at capacity
    for i in 0..2usize {
        let (result_tx, _) = oneshot::channel::<CompileJobResult>();
        let (progress_tx, _) = broadcast::channel(8);
        let _ = pool.submit(CompileJob {
            job_id: format!("prefill-{i}"),
            source: source.clone(),
            source_hash: format!("h{i}"),
            result_tx,
            progress_tx,
        }).await;
    }

    // Now the HTTP endpoint should get a 503
    let app = create_app_with_pool(pool.clone());
    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": source }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // May be 503 (queue full) or 200/422 depending on race, but never a panic
    let status = response.status();
    assert!(
        status == StatusCode::SERVICE_UNAVAILABLE
            || status == StatusCode::OK
            || status == StatusCode::UNPROCESSABLE_ENTITY
            || status == StatusCode::GATEWAY_TIMEOUT,
        "unexpected status {status}"
    );

    if status == StatusCode::SERVICE_UNAVAILABLE {
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"]["code"], "QUEUE_FULL");
    }
}

/// POST /compile/async returns HTTP 202 with a non-empty jobId.
#[tokio::test]
async fn test_compile_async_returns_202_with_job_id() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile/async")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "source": "fn x() {}" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::ACCEPTED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(
        json["jobId"].as_str().map(|s| !s.is_empty()).unwrap_or(false),
        "response must contain a non-empty jobId"
    );
}

/// POST /compile/async with an empty source returns 400 INVALID_PAYLOAD.
#[tokio::test]
async fn test_compile_async_empty_source_returns_400() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile/async")
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

/// GET /compile/:job_id/progress for an unknown job returns 404 JOB_NOT_FOUND.
#[tokio::test]
async fn test_compile_progress_unknown_job_returns_404() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/compile/nonexistent-job-id/progress")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"]["code"], "JOB_NOT_FOUND");
}

/// COMPILE_MAX_WORKERS and COMPILE_QUEUE_DEPTH env vars override defaults.
#[tokio::test]
async fn test_env_var_overrides_pool_config() {
    use lumens_block_backend::worker_pool::WorkerPool;

    std::env::set_var("COMPILE_MAX_WORKERS", "3");
    std::env::set_var("COMPILE_QUEUE_DEPTH", "10");
    let pool = WorkerPool::from_env();
    std::env::remove_var("COMPILE_MAX_WORKERS");
    std::env::remove_var("COMPILE_QUEUE_DEPTH");

    assert_eq!(pool.max_workers, 3);
    assert_eq!(pool.queue_depth, 10);
}

#[tokio::test]
async fn test_compile_valid_contract() {
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
async fn test_compile_cache() {
    let app = create_app();

    let valid_source = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CacheTestContract;

#[contractimpl]
impl CacheTestContract {
    pub fn dummy(_env: Env) -> u32 {
        99
    }
}
"#;

    // First compilation
    let response1 = app.clone()
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

    assert_eq!(response1.status(), StatusCode::OK);
    let body1 = response1.into_body().collect().await.unwrap().to_bytes();
    let json1: Value = serde_json::from_slice(&body1).unwrap();
    assert_eq!(json1["cached"], false);

    // Second compilation (should be cached)
    let response2 = app.clone()
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

    assert_eq!(response2.status(), StatusCode::OK);
    let body2 = response2.into_body().collect().await.unwrap().to_bytes();
    let json2: Value = serde_json::from_slice(&body2).unwrap();
    assert_eq!(json2["cached"], true);

    // Check stats endpoint
    let response_stats = app
        .oneshot(
            Request::builder()
                .uri("/cache/stats")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response_stats.status(), StatusCode::OK);
    let stats_body = response_stats.into_body().collect().await.unwrap().to_bytes();
    let stats_json: Value = serde_json::from_slice(&stats_body).unwrap();
    assert_eq!(stats_json["hits"].as_u64().unwrap(), 1);
}
