use axum::{
    http::{HeaderValue, Method},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

pub mod handlers;
pub mod worker_pool;

use worker_pool::WorkerPool;

pub fn create_app() -> Router {
    let pool = WorkerPool::from_env();
    create_app_with_pool(pool)
}

/// Construct the application with an explicitly provided pool.
/// Used by tests to inject small pools without touching env vars.
pub fn create_app_with_pool(pool: Arc<WorkerPool>) -> Router {
    let origins = [
        "http://localhost:3000".parse::<HeaderValue>().unwrap(),
        "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
    ];

    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/health", get(handlers::health::health_check))
        // Synchronous compile — backwards-compatible
        .route("/compile", post(handlers::compile::compile))
        // Async compile — returns jobId immediately (HTTP 202)
        .route("/compile/async", post(handlers::compile::compile_async))
        // SSE progress stream for an async job
        .route(
            "/compile/:job_id/progress",
            get(handlers::compile::compile_progress),
        )
        .route("/deploy", post(handlers::deploy::deploy))
        .route("/invoke", post(handlers::invoke::invoke))
        .with_state(pool)
        .layer(cors)
}
