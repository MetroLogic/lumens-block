use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;
use tracing::info;

pub struct WasmCacheEntry {
    pub wasm_base64: String,
    pub size_bytes: usize,
    pub inserted_at: Instant,
}

pub struct WasmCache {
    /// Protects concurrent access to the cache map.
    /// RwLock allows multiple concurrent readers (cache hits) without blocking,
    /// while providing exclusive access to writers when inserting new entries.
    entries: RwLock<HashMap<String, WasmCacheEntry>>,
    ttl: Duration,
    max_entries: usize,
    hits: AtomicU64,
    misses: AtomicU64,
}

impl WasmCache {
    pub fn new(ttl: Duration, max_entries: usize) -> Arc<Self> {
        Arc::new(Self {
            entries: RwLock::new(HashMap::new()),
            ttl,
            max_entries,
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        })
    }

    pub async fn get(&self, hash: &str) -> Option<(String, usize)> {
        let entries = self.entries.read().await;
        if let Some(entry) = entries.get(hash) {
            if entry.inserted_at.elapsed() <= self.ttl {
                info!("[cache HIT] hash={}", &hash[..8.min(hash.len())]);
                self.hits.fetch_add(1, Ordering::Relaxed);
                return Some((entry.wasm_base64.clone(), entry.size_bytes));
            }
        }
        info!("[cache MISS] hash={}", &hash[..8.min(hash.len())]);
        self.misses.fetch_add(1, Ordering::Relaxed);
        None
    }

    pub async fn insert(&self, hash: &str, wasm_base64: String, size_bytes: usize) {
        let mut entries = self.entries.write().await;
        
        // LRU-like eviction if full
        if entries.len() >= self.max_entries {
            // Find the oldest entry
            let oldest = entries
                .iter()
                .min_by_key(|(_, entry)| entry.inserted_at)
                .map(|(k, _)| k.clone());
                
            if let Some(oldest_key) = oldest {
                entries.remove(&oldest_key);
            }
        }

        entries.insert(
            hash.to_string(),
            WasmCacheEntry {
                wasm_base64,
                size_bytes,
                inserted_at: Instant::now(),
            },
        );
    }

    pub async fn evict_stale(&self) {
        let mut entries = self.entries.write().await;
        let now = Instant::now();
        entries.retain(|_, entry| now.duration_since(entry.inserted_at) <= self.ttl);
    }
    
    pub async fn stats(&self) -> (u64, u64, usize) {
        let entries = self.entries.read().await;
        let count = entries.len();
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        (hits, misses, count)
    }
}
