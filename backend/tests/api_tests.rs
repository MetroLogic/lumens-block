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
