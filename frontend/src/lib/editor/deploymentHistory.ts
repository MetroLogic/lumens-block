import type { StellarNetwork } from "@/lib/stellar/deploy"

export interface DeploymentRecord {
  id: string
  timestamp: string
  network: StellarNetwork
  contractId: string
  txHash: string
}

const STORAGE_KEY = "lumens-block:deployments"
const MAX_RECORDS = 50

/**
 * Loads the persistent deployment history from localStorage.
 * Returns an empty array when storage is unavailable or malformed.
 */
export function loadDeployments(): DeploymentRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is DeploymentRecord =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.timestamp === "string" &&
        (item.network === "testnet" || item.network === "mainnet") &&
        typeof item.contractId === "string" &&
        typeof item.txHash === "string"
    )
  } catch {
    return []
  }
}

/**
 * Persists the deployment history to localStorage.
 * Truncates to the most recent MAX_RECORDS entries.
 */
export function saveDeployments(records: DeploymentRecord[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  } catch {
    // Storage quota exceeded or unavailable — fail silently.
  }
}

/**
 * Appends a successful deployment to history and returns the updated list.
 */
export function addDeployment(record: Omit<DeploymentRecord, "id" | "timestamp">): DeploymentRecord[] {
  const next: DeploymentRecord = {
    ...record,
    id: `deploy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  }
  const records = [next, ...loadDeployments()].slice(0, MAX_RECORDS)
  saveDeployments(records)
  return records
}

/**
 * Removes a single deployment record by id and returns the updated list.
 */
export function removeDeployment(id: string): DeploymentRecord[] {
  const records = loadDeployments().filter((record) => record.id !== id)
  saveDeployments(records)
  return records
}

/**
 * Clears the entire deployment history.
 */
export function clearDeployments(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}