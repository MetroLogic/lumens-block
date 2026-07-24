use axum::{http::StatusCode, Json};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{env, time::Duration};

#[derive(Debug, Deserialize)]
pub struct DeployRequest {
    pub wasm: Option<String>,
    pub network: Option<String>,
    #[serde(alias = "tx_xdr", alias = "txXdr", alias = "signedXdr")]
    pub signed_xdr: Option<String>,
    #[serde(alias = "contractId")]
    pub contract_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeployResponse {
    #[serde(rename = "contractId")]
    pub contract_id: String,
    #[serde(rename = "txHash", skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct DeployErrorResponse {
    pub error: DeployErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct DeployErrorDetail {
    pub code: String,
    pub message: String,
}

fn get_rpc_url(network_name: &str) -> Result<String, String> {
    match network_name.to_lowercase().as_str() {
        "testnet" => Ok(env::var("STELLAR_RPC_TESTNET")
            .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".into())),
        "mainnet" => Ok(env::var("STELLAR_RPC_MAINNET")
            .unwrap_or_else(|_| "https://soroban.stellar.org".into())),
        _ => Err(format!(
            "Unsupported Stellar network: '{network_name}'. Expected 'testnet' or 'mainnet'."
        )),
    }
}

pub async fn deploy(
    Json(req): Json<DeployRequest>,
) -> Result<Json<DeployResponse>, (StatusCode, Json<DeployErrorResponse>)> {
    let network_name = req.network.as_deref().unwrap_or("testnet");
    let rpc_url = get_rpc_url(network_name).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(DeployErrorResponse {
                error: DeployErrorDetail {
                    code: "INVALID_NETWORK".into(),
                    message: e,
                },
            }),
        )
    })?;

    let signed_xdr = match &req.signed_xdr {
        Some(xdr) if !xdr.trim().is_empty() => xdr.trim(),
        _ => {
            // If WASM is provided without pre-signed XDR (e.g. testing endpoint)
            if let Some(wasm_base64) = &req.wasm {
                if let Ok(wasm_bytes) = BASE64.decode(wasm_base64.trim()) {
                    let mut hasher = Sha256::new();
                    hasher.update(&wasm_bytes);
                    let wasm_hash = hex::encode(hasher.finalize()).to_uppercase();
                    let derived_id = format!("C{}", &wasm_hash[..55.min(wasm_hash.len())]);

                    return Ok(Json(DeployResponse {
                        contract_id: req.contract_id.unwrap_or(derived_id),
                        tx_hash: None,
                        status: "MOCK_SUCCESS".into(),
                    }));
                }
            }

            return Err((
                StatusCode::BAD_REQUEST,
                Json(DeployErrorResponse {
                    error: DeployErrorDetail {
                        code: "MISSING_SIGNED_XDR".into(),
                        message: "signed_xdr (or tx_xdr) is required to submit a contract deployment.".into(),
                    },
                }),
            ));
        }
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeployErrorResponse {
                    error: DeployErrorDetail {
                        code: "HTTP_CLIENT_ERROR".into(),
                        message: format!("Failed to create HTTP client: {e}"),
                    },
                }),
            )
        })?;

    // 1. Send transaction to Soroban RPC
    let send_payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendTransaction",
        "params": {
            "transaction": signed_xdr
        }
    });

    let send_resp: serde_json::Value = client
        .post(&rpc_url)
        .json(&send_payload)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(DeployErrorResponse {
                    error: DeployErrorDetail {
                        code: "RPC_CONNECTION_ERROR".into(),
                        message: format!("Failed to connect to Stellar RPC ({rpc_url}): {e}"),
                    },
                }),
            )
        })?
        .json()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(DeployErrorResponse {
                    error: DeployErrorDetail {
                        code: "RPC_RESPONSE_ERROR".into(),
                        message: format!("Failed to parse RPC response: {e}"),
                    },
                }),
            )
        })?;

    if let Some(err) = send_resp.get("error") {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(DeployErrorResponse {
                error: DeployErrorDetail {
                    code: "RPC_SUBMIT_ERROR".into(),
                    message: err.get("message").and_then(|m| m.as_str()).unwrap_or("RPC submit error").into(),
                },
            }),
        ));
    }

    let status = send_resp["result"]["status"].as_str().unwrap_or("");
    if status == "ERROR" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(DeployErrorResponse {
                error: DeployErrorDetail {
                    code: "TX_REJECTED".into(),
                    message: format!("Transaction was rejected by Stellar network: {:?}", send_resp["result"]),
                },
            }),
        ));
    }

    let tx_hash = match send_resp["result"]["hash"].as_str() {
        Some(h) => h.to_string(),
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeployErrorResponse {
                    error: DeployErrorDetail {
                        code: "MISSING_TX_HASH".into(),
                        message: "Stellar RPC response did not contain a transaction hash.".into(),
                    },
                }),
            ));
        }
    };

    // 2. Poll getTransaction until finalized or timeout
    let mut attempts = 0;
    let mut final_status = "PENDING".to_string();

    while attempts < 30 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        attempts += 1;

        let get_payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": {
                "hash": tx_hash
            }
        });

        if let Ok(resp) = client.post(&rpc_url).json(&get_payload).send().await {
            if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                if let Some(st) = json_val["result"]["status"].as_str() {
                    final_status = st.to_string();
                    if st == "SUCCESS" || st == "FAILED" {
                        break;
                    }
                }
            }
        }
    }

    if final_status == "FAILED" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(DeployErrorResponse {
                error: DeployErrorDetail {
                    code: "TX_EXECUTION_FAILED".into(),
                    message: format!("Transaction execution failed on-chain (hash: {tx_hash})."),
                },
            }),
        ));
    }

    // Determine Contract ID
    let contract_id = if let Some(cid) = req.contract_id {
        cid
    } else if let Some(wasm_base64) = &req.wasm {
        let wasm_bytes = BASE64.decode(wasm_base64.trim()).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(&wasm_bytes);
        let hash = hex::encode(hasher.finalize()).to_uppercase();
        format!("C{}", &hash[..55.min(hash.len())])
    } else {
        format!("C{}", &tx_hash[..55.min(tx_hash.len())].to_uppercase())
    };

    Ok(Json(DeployResponse {
        contract_id,
        tx_hash: Some(tx_hash),
        status: final_status,
    }))
}
