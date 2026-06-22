import type { StellarNetwork } from "./deploy"

export const DEPLOYMENT_HISTORY_STORAGE_KEY = "lumens-block:deployments"
export const DEPLOYMENT_HISTORY_LIMIT = 50

type DeploymentStorage = Pick<Storage, "getItem" | "setItem">

export interface DeploymentRecordInput {
  network: StellarNetwork
  contractId?: string | null
  transactionHash?: string | null
  deployer?: string | null
  estimatedFee?: string | null
  wasmHash?: string | null
  sourceHash?: string | null
  sizeBytes?: number | null
  message?: string | null
}

export interface DeploymentRecord {
  id: string
  createdAt: string
  network: StellarNetwork
  contractId?: string
  transactionHash?: string
  deployer?: string
  estimatedFee?: string
  wasmHash?: string
  sourceHash?: string
  sizeBytes?: number
  message?: string
}

function getDefaultStorage(): DeploymentStorage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isStellarNetwork(value: unknown): value is StellarNetwork {
  return value === "testnet" || value === "mainnet"
}

function createDeploymentId(now: Date): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `deployment_${now.getTime()}_${crypto.randomUUID()}`
  }

  return `deployment_${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeRecord(value: unknown): DeploymentRecord | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const id = optionalString(record.id)
  const createdAt = optionalString(record.createdAt)
  const network = record.network

  if (!id || !createdAt || !isStellarNetwork(network)) {
    return null
  }

  const normalized: DeploymentRecord = { id, createdAt, network }
  const contractId = optionalString(record.contractId)
  const transactionHash = optionalString(record.transactionHash)
  const deployer = optionalString(record.deployer)
  const estimatedFee = optionalString(record.estimatedFee)
  const wasmHash = optionalString(record.wasmHash)
  const sourceHash = optionalString(record.sourceHash)
  const message = optionalString(record.message)
  const sizeBytes =
    typeof record.sizeBytes === "number" && Number.isFinite(record.sizeBytes)
      ? record.sizeBytes
      : undefined

  if (contractId) normalized.contractId = contractId
  if (transactionHash) normalized.transactionHash = transactionHash
  if (deployer) normalized.deployer = deployer
  if (estimatedFee) normalized.estimatedFee = estimatedFee
  if (wasmHash) normalized.wasmHash = wasmHash
  if (sourceHash) normalized.sourceHash = sourceHash
  if (message) normalized.message = message
  if (sizeBytes !== undefined) normalized.sizeBytes = sizeBytes

  return normalized
}

export function readDeploymentHistory(storage: DeploymentStorage | null = getDefaultStorage()): DeploymentRecord[] {
  if (!storage) return []

  try {
    const raw = storage.getItem(DEPLOYMENT_HISTORY_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(normalizeRecord)
      .filter((record): record is DeploymentRecord => record !== null)
      .slice(0, DEPLOYMENT_HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function writeDeploymentHistory(
  records: DeploymentRecord[],
  storage: DeploymentStorage | null = getDefaultStorage()
): DeploymentRecord[] {
  const normalized = records
    .map(normalizeRecord)
    .filter((record): record is DeploymentRecord => record !== null)
    .slice(0, DEPLOYMENT_HISTORY_LIMIT)

  storage?.setItem(DEPLOYMENT_HISTORY_STORAGE_KEY, JSON.stringify(normalized))

  return normalized
}

export function createDeploymentRecord(
  input: DeploymentRecordInput,
  now: Date = new Date()
): DeploymentRecord {
  const record: DeploymentRecord = {
    id: createDeploymentId(now),
    createdAt: now.toISOString(),
    network: input.network,
  }

  const contractId = optionalString(input.contractId)
  const transactionHash = optionalString(input.transactionHash)
  const deployer = optionalString(input.deployer)
  const estimatedFee = optionalString(input.estimatedFee)
  const wasmHash = optionalString(input.wasmHash)
  const sourceHash = optionalString(input.sourceHash)
  const message = optionalString(input.message)

  if (contractId) record.contractId = contractId
  if (transactionHash) record.transactionHash = transactionHash
  if (deployer) record.deployer = deployer
  if (estimatedFee) record.estimatedFee = estimatedFee
  if (wasmHash) record.wasmHash = wasmHash
  if (sourceHash) record.sourceHash = sourceHash
  if (message) record.message = message
  if (typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes)) {
    record.sizeBytes = input.sizeBytes
  }

  return record
}

export function appendDeploymentRecord(
  input: DeploymentRecordInput,
  storage: DeploymentStorage | null = getDefaultStorage()
): DeploymentRecord {
  const record = createDeploymentRecord(input)
  const records = readDeploymentHistory(storage)

  writeDeploymentHistory([record, ...records], storage)

  return record
}

export function removeDeploymentRecord(
  id: string,
  storage: DeploymentStorage | null = getDefaultStorage()
): DeploymentRecord[] {
  const records = readDeploymentHistory(storage).filter((record) => record.id !== id)
  return writeDeploymentHistory(records, storage)
}

export function getStellarExpertTransactionUrl(record: DeploymentRecord): string | null {
  if (!record.transactionHash) return null
  return `https://stellar.expert/explorer/${record.network}/tx/${record.transactionHash}`
}

export function getStellarExpertContractUrl(record: DeploymentRecord): string | null {
  if (!record.contractId) return null
  return `https://stellar.expert/explorer/${record.network}/contract/${record.contractId}`
}
