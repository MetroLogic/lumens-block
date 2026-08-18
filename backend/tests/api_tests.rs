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
