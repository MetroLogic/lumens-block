use axum::{extract::State, Json};
use serde::Serialize;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct CacheStatsResponse {
    pub hits: u64,
    pub misses: u64,
    pub entries: usize,
}

pub async fn cache_stats(State(state): State<AppState>) -> Json<CacheStatsResponse> {
    let (hits, misses, entries) = state.cache.stats().await;
    Json(CacheStatsResponse {
        hits,
        misses,
        entries,
    })
}
