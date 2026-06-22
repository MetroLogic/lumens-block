import type { Edge, Node } from "reactflow"
import { Asset, Horizon, Networks, Operation, SorobanRpc, TransactionBuilder } from "@stellar/stellar-sdk"

import type { CompileError, ContractGraph as SchemaContractGraph } from "@/lib/compile/schema"
import { normalizeReactFlowGraph } from "@/lib/compile/validate"

/** @deprecated Import from `@/lib/compile/schema` for the canonical schema type. */
export type ContractGraph = SchemaContractGraph

export interface CompileResponse {
  wasm: string
  sourceHash: string
  sizeBytes: number
}

export class CompileContractError extends Error {
  readonly code: string
  readonly details?: string[]

  constructor(error: CompileError) {
    super(error.message)
    this.name = "CompileContractError"
    this.code = error.code
    this.details = error.details
  }
}

export type StellarNetwork = "testnet" | "mainnet"

export interface DeployContractResult {
  message: string
  network: StellarNetwork
  deployer: string
  estimatedFee: string
  wasmHash: string
  sourceHash: string
  sizeBytes: number
  contractId?: string
  transactionHash?: string
}

const NETWORK_CONFIG: Record<StellarNetwork, { horizonUrl: string; rpcUrl: string; passphrase: string }> = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: "https://soroban.stellar.org",
    passphrase: Networks.PUBLIC,
  },
}

export function getNetworkConfig(network: StellarNetwork) {
  return NETWORK_CONFIG[network]
}

/**
 * Connects to Freighter wallet and returns the user's public key.
 */
export async function connectWallet(): Promise<string> {
  const freighter = await import("@stellar/freighter-api")
  return freighter.getPublicKey()
}

export async function fetchWalletBalance(
  publicKey: string,
  network: StellarNetwork
): Promise<string> {
  const server = new Horizon.Server(NETWORK_CONFIG[network].horizonUrl)
  const account = await server.loadAccount(publicKey)
  const nativeBalance = account.balances.find((balance) => balance.asset_type === "native")

  if (!nativeBalance || typeof nativeBalance.balance !== "string") {
    throw new Error("Unable to fetch native XLM balance")
  }

  return nativeBalance.balance
}

export async function estimateDeploymentFee(
  graph: { nodes: Node[]; edges: Edge[] },
  network: StellarNetwork,
  publicKey: string
): Promise<string> {
  const config = getNetworkConfig(network)
  const horizonServer = new Horizon.Server(config.horizonUrl)
  const rpcServer = new SorobanRpc.Server(config.rpcUrl)
  const account = await horizonServer.loadAccount(publicKey)

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.payment({
        destination: publicKey,
        amount: "0.0000001",
        asset: Asset.native(),
      })
    )
    .addOperation(Operation.bumpSequence({ bumpTo: account.sequence }))
    .setTimeout(30)
    .build()

  const response = await rpcServer.simulateTransaction(tx)

  if ("error" in response) {
    throw new Error(response.error || "Unable to estimate deployment fee")
  }

  if (!("minResourceFee" in response) && !("feeCharged" in response)) {
    throw new Error("Unable to estimate deployment fee")
  }

  const feeInStroops = Number(
    ((response as unknown as { minResourceFee?: string | number; feeCharged?: string | number }).minResourceFee ??
      (response as unknown as { feeCharged?: string | number }).feeCharged ??
      0)
  )
  const feeLabel = (feeInStroops / 1_000_000).toFixed(7)

  if (graph.nodes.length === 0 && graph.edges.length === 0) {
    return feeLabel
  }

  return feeLabel
}

/**
 * Sends a contract graph to the compile API and returns the WASM binary.
 */
export async function compileContract(graph: {
  nodes: Node[]
  edges: Edge[]
}): Promise<CompileResponse> {
  const payload = normalizeReactFlowGraph(graph)

  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as CompileResponse | { error: CompileError }

  if (!response.ok) {
    const error = "error" in body ? body.error : { code: "UNKNOWN", message: "Compilation failed." }
    throw new CompileContractError(error)
  }

  return body as CompileResponse
}

function decodeWasmBase64(wasmBase64: string): Uint8Array {
  const binary = atob(wasmBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Compiles a contract graph to WASM and returns a deployment summary.
 * On-chain Soroban deployment will use the compiled WASM in a follow-up step.
 */
export async function deployContract(
  graph: { nodes: Node[]; edges: Edge[] },
  network: StellarNetwork = "testnet"
): Promise<DeployContractResult> {
  const publicKey = await connectWallet()
  const compiled = await compileContract(graph)
  const wasmBytes = decodeWasmBase64(compiled.wasm)

  const digest = await crypto.subtle.digest("SHA-256", wasmBytes)
  const hashHex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const estimatedFee = await estimateDeploymentFee(graph, network, publicKey)

  const message = `WASM compiled (${compiled.sizeBytes} bytes, hash ${hashHex.slice(0, 16)}) for ${publicKey.slice(0, 8)}... (estimated fee ${estimatedFee} XLM)`

  return {
    message,
    network,
    deployer: publicKey,
    estimatedFee,
    wasmHash: hashHex,
    sourceHash: compiled.sourceHash,
    sizeBytes: compiled.sizeBytes,
  }
}
