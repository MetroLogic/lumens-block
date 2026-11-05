use axum::{
    http::{HeaderValue, Method},
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};

pub mod cache;
pub mod handlers;
pub mod worker_pool;

use cache::WasmCache;
use worker_pool::WorkerPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<WorkerPool>,
    pub cache: Arc<WasmCache>,
}

pub fn create_app() -> Router {
    let pool = WorkerPool::from_env();
    create_app_with_pool(pool)
}

/// Construct the application with an explicitly provided pool.
/// Used by tests to inject small pools without touching env vars.
pub fn create_app_with_pool(pool: Arc<WorkerPool>) -> Router {
    let ttl_secs = std::env::var("WASM_CACHE_TTL_SECS")
        .unwrap_or_else(|_| "3600".to_string())
        .parse::<u64>()
        .unwrap_or(3600);
    
    let max_entries = std::env::var("WASM_CACHE_MAX_ENTRIES")
        .unwrap_or_else(|_| "256".to_string())
        .parse::<usize>()
        .unwrap_or(256);
        
    let cache = WasmCache::new(Duration::from_secs(ttl_secs), max_entries);
    
    // Spawn background eviction task
    let bg_cache = cache.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(600)).await;
            bg_cache.evict_stale().await;
        }
    });

    let state = AppState { pool, cache };

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
        // Cache stats
        .route("/cache/stats", get(handlers::cache::cache_stats))
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
        .with_state(state)
        .layer(cors)
}
