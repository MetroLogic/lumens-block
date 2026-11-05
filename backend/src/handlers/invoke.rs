use axum::{http::StatusCode, Json};
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{env, sync::OnceLock, time::Duration};

// ─── Request / Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeArg {
    /// One of: "Address", "i128", "bool", "Symbol"
    #[serde(rename = "type")]
    pub arg_type: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeRequest {
    pub contract_id: Option<String>,
    pub network: Option<String>,
    pub function_name: Option<String>,
    pub args: Option<Vec<InvokeArg>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub topics: Vec<String>,
    pub data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeResources {
    pub instructions: u64,
    pub read_bytes: u64,
    pub write_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeResponse {
    pub success: bool,
    pub return_value: String,
    pub events: Vec<InvokeEvent>,
    pub resources: InvokeResources,
}

#[derive(Debug, Serialize)]
pub struct InvokeErrorResponse {
    pub error: InvokeErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct InvokeErrorDetail {
    pub code: String,
    pub message: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/// Returns true when `name` matches the Rust identifier pattern `^[a-z_][a-z0-9_]*$`.
fn is_valid_function_name(name: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[a-z_][a-z0-9_]*$").expect("invalid regex"))
        .is_match(name)
}

/// Encode a single arg as an XDR ScVal JSON object understood by the Soroban RPC.
/// We use the JSON-XDR representation accepted by `simulateTransaction`.
fn encode_arg(arg: &InvokeArg) -> Result<serde_json::Value, String> {
    match arg.arg_type.as_str() {
        "Address" => {
            if arg.value.trim().is_empty() {
                return Err("Address value cannot be empty.".into());
            }
            Ok(json!({
                "address": { "accountId": { "publicKeyTypeEd25519": arg.value.trim() } }
            }))
        }
        "i128" => {
            let n: i128 = arg.value.trim().parse().map_err(|_| {
                format!("'{}' is not a valid i128 integer.", arg.value)
            })?;
            // Soroban JSON-XDR i128 is split into hi (i64) and lo (u64)
            let hi = (n >> 64) as i64;
            let lo = n as u64;
            Ok(json!({
                "i128": { "hi": hi, "lo": lo }
            }))
        }
        "bool" => {
            let b = match arg.value.trim().to_lowercase().as_str() {
                "true" | "1" => true,
                "false" | "0" => false,
                _ => return Err(format!("'{}' is not a valid boolean.", arg.value)),
            };
            Ok(json!({ "bool": b }))
        }
        "Symbol" => {
            if arg.value.len() > 32 {
                return Err("Symbol value must be 32 characters or fewer.".into());
            }
            Ok(json!({ "symbol": arg.value }))
        }
        other => Err(format!(
            "Unsupported arg type '{}'. Supported: Address, i128, bool, Symbol.",
            other
        )),
    }
}

/// Decode an XDR ScVal JSON object into a human-readable string.
fn decode_scval(val: &serde_json::Value) -> String {
    if let Some(b) = val.get("bool").and_then(|v| v.as_bool()) {
        return b.to_string();
    }
    if let Some(sym) = val.get("symbol").and_then(|v| v.as_str()) {
        return sym.to_owned();
    }
    if let Some(s) = val.get("string").and_then(|v| v.as_str()) {
        return s.to_owned();
    }
    if let Some(i128_obj) = val.get("i128") {
        let hi = i128_obj.get("hi").and_then(|v| v.as_i64()).unwrap_or(0) as i128;
        let lo = i128_obj.get("lo").and_then(|v| v.as_u64()).unwrap_or(0) as i128;
        return ((hi << 64) | lo).to_string();
    }
    if let Some(u128_obj) = val.get("u128") {
        let hi = u128_obj.get("hi").and_then(|v| v.as_u64()).unwrap_or(0) as u128;
        let lo = u128_obj.get("lo").and_then(|v| v.as_u64()).unwrap_or(0) as u128;
        return ((hi << 64) | lo).to_string();
    }
    if let Some(u32) = val.get("u32").and_then(|v| v.as_u64()) {
        return u32.to_string();
    }
    if let Some(i32) = val.get("i32").and_then(|v| v.as_i64()) {
        return i32.to_string();
    }
    if val.get("void").is_some() {
        return "(void)".to_owned();
    }
    // Fallback: pretty-print the raw JSON (truncated)
    let raw = val.to_string();
    if raw.len() > 128 {
        format!("{}…", &raw[..128])
    } else {
        raw
    }
}

/// Parse the events array from the simulation response.
fn parse_events(events: &serde_json::Value) -> Vec<InvokeEvent> {
    let arr = match events.as_array() {
        Some(a) => a,
        None => return vec![],
    };

    arr.iter()
        .map(|ev| {
            let event_type = ev
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("contract")
                .to_owned();

            let topics = ev
                .get("body")
                .and_then(|b| b.get("v0"))
                .and_then(|v0| v0.get("topics"))
                .and_then(|t| t.as_array())
                .map(|arr| arr.iter().map(|t| decode_scval(t)).collect())
                .unwrap_or_default();

            let data = ev
                .get("body")
                .and_then(|b| b.get("v0"))
                .and_then(|v0| v0.get("data"))
                .map(|d| decode_scval(d))
                .unwrap_or_default();

            InvokeEvent { event_type, topics, data }
        })
        .collect()
}

// ─── Handler ──────────────────────────────────────────────────────────────────

pub async fn invoke(
    Json(req): Json<InvokeRequest>,
) -> Result<Json<InvokeResponse>, (StatusCode, Json<InvokeErrorResponse>)> {
    // ── Validate contractId ───────────────────────────────────────────────────
    let contract_id = match &req.contract_id {
        Some(id) if !id.trim().is_empty() => id.trim().to_owned(),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(InvokeErrorResponse {
                    error: InvokeErrorDetail {
                        code: "MISSING_CONTRACT_ID".into(),
                        message: "contractId is required and must be non-empty.".into(),
                    },
                }),
            ));
        }
    };

    // ── Validate functionName ─────────────────────────────────────────────────
    let function_name = match &req.function_name {
        Some(name) if !name.trim().is_empty() => {
            let name = name.trim();
            if !is_valid_function_name(name) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(InvokeErrorResponse {
                        error: InvokeErrorDetail {
                            code: "INVALID_FUNCTION_NAME".into(),
                            message: format!(
                                "functionName '{}' is invalid. Must match ^[a-z_][a-z0-9_]*$.",
                                name
                            ),
                        },
                    }),
                ));
            }
            name.to_owned()
        }
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(InvokeErrorResponse {
                    error: InvokeErrorDetail {
                        code: "MISSING_FUNCTION_NAME".into(),
                        message: "functionName is required and must be non-empty.".into(),
                    },
                }),
            ));
        }
    };

    // ── Resolve network ───────────────────────────────────────────────────────
    let network_name = req.network.as_deref().unwrap_or("testnet");
    let rpc_url = get_rpc_url(network_name).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(InvokeErrorResponse {
                error: InvokeErrorDetail {
                    code: "INVALID_NETWORK".into(),
                    message: e,
                },
            }),
        )
    })?;

    // ── Encode args ───────────────────────────────────────────────────────────
    let raw_args = req.args.unwrap_or_default();
    let mut encoded_args: Vec<serde_json::Value> = Vec::with_capacity(raw_args.len());
    for (idx, arg) in raw_args.iter().enumerate() {
        match encode_arg(arg) {
            Ok(v) => encoded_args.push(v),
            Err(msg) => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(InvokeErrorResponse {
                        error: InvokeErrorDetail {
                            code: "INVALID_ARG".into(),
                            message: format!("Argument at index {idx}: {msg}"),
                        },
                    }),
                ));
            }
        }
    }

    // ── Build simulateTransaction JSON-RPC payload ────────────────────────────
    // We use the JSON-XDR representation of a Soroban invocation directly,
    // which avoids depending on the stellar-xdr crate for encoding in the handler.
    // The RPC accepts `invokeContractArgs` in the `simulateTransaction` method.
    let invoke_host_fn = json!({
        "invokeContract": {
            "contractAddress": contract_id,
            "functionName": function_name,
            "args": encoded_args,
        }
    });

    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "simulateTransaction",
        "params": {
            "transaction": invoke_host_fn
        }
    });

    // ── Send to Soroban RPC ───────────────────────────────────────────────────
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(InvokeErrorResponse {
                    error: InvokeErrorDetail {
                        code: "HTTP_CLIENT_ERROR".into(),
                        message: format!("Failed to create HTTP client: {e}"),
                    },
                }),
            )
        })?;

    let rpc_resp: serde_json::Value = client
        .post(&rpc_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(InvokeErrorResponse {
                    error: InvokeErrorDetail {
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
                Json(InvokeErrorResponse {
                    error: InvokeErrorDetail {
                        code: "RPC_RESPONSE_ERROR".into(),
                        message: format!("Failed to parse RPC response: {e}"),
                    },
                }),
            )
        })?;

    // ── Parse RPC-level errors ────────────────────────────────────────────────
    if let Some(err) = rpc_resp.get("error") {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(InvokeErrorResponse {
                error: InvokeErrorDetail {
                    code: "RPC_ERROR".into(),
                    message: err
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown RPC error")
                        .to_owned(),
                },
            }),
        ));
    }

    let result = &rpc_resp["result"];

    // Check for simulation-level error
    if let Some(error_str) = result.get("error").and_then(|e| e.as_str()) {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(InvokeErrorResponse {
                error: InvokeErrorDetail {
                    code: "INVOKE_SIMULATION_ERROR".into(),
                    message: error_str.to_owned(),
                },
            }),
        ));
    }

    // ── Decode return value ───────────────────────────────────────────────────
    let return_value = result
        .get("results")
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.first())
        .and_then(|first| first.get("xdr"))
        .map(|xdr_val| decode_scval(xdr_val))
        .unwrap_or_default();

    // ── Parse events ──────────────────────────────────────────────────────────
    let events = result
        .get("events")
        .map(|e| parse_events(e))
        .unwrap_or_default();

    // ── Extract resources ─────────────────────────────────────────────────────
    let instructions = result
        .get("cost")
        .and_then(|c| c.get("cpuInsns"))
        .and_then(|v| v.as_str().and_then(|s| s.parse::<u64>().ok()).or_else(|| v.as_u64()))
        .unwrap_or(0);

    let read_bytes = result
        .pointer("/transactionData/readBytes")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let write_bytes = result
        .pointer("/transactionData/writeBytes")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    Ok(Json(InvokeResponse {
        success: true,
        return_value,
        events,
        resources: InvokeResources {
            instructions,
            read_bytes,
            write_bytes,
        },
    }))
}
