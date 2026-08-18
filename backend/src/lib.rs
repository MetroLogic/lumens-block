use axum::{
    http::{HeaderValue, Method},
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

pub mod handlers;

pub fn create_app() -> Router {
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
        .route("/compile", post(handlers::compile::compile))
        .route("/deploy", post(handlers::deploy::deploy))
        .route("/invoke", post(handlers::invoke::invoke))
        .layer(cors)
}
