import type { Edge, Node } from "reactflow"
import {
  Address,
  Horizon,
  Networks,
  Operation,
  SorobanRpc,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import type { Account, Transaction } from "@stellar/stellar-sdk"

import type { CompileError, ContractGraph as SchemaContractGraph } from "@/lib/compile/schema"
import { normalizeReactFlowGraph } from "@/lib/compile/validate"

/** @deprecated Import from `@/lib/compile/schema` for the canonical schema type. */
export type ContractGraph = SchemaContractGraph

export interface CompileResponse {
  wasm: string
  sourceHash: string
  sizeBytes: number
}

export interface DeploymentResult {
  network: StellarNetwork
  contractId: string
  contractUrl: string
  wasmHash: string
  uploadTransactionHash: string
  createTransactionHash: string
  sizeBytes: number
  sourceHash: string
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

export function getStellarExpertContractUrl(network: StellarNetwork, contractId: string) {
  const networkPath = network === "mainnet" ? "public" : "testnet"
  return `https://stellar.expert/explorer/${networkPath}/contract/${contractId}`
}

/**
 * Connects to Freighter wallet and returns the user's public key.
 */
export async function connectWallet(): Promise<string> {
  const freighter = await import("@stellar/freighter-api")
  return freighter.getPublicKey()
}

export async function fetchWalletBalance(publicKey: string, network: StellarNetwork): Promise<string> {
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
  const account = await loadSourceAccount(rpcServer, horizonServer, publicKey)
  const compiled = await compileContract(graph)
  const wasmBytes = decodeWasmBase64(compiled.wasm)
  const preparedUploadTx = await prepareSorobanTx(
    rpcServer,
    account,
    config.passphrase,
    Operation.uploadContractWasm({ wasm: wasmBytes })
  )
  const feeInStroops = Number(preparedUploadTx.fee)
  const feeLabel = (feeInStroops / 10_000_000).toFixed(7)

  if (graph.nodes.length === 0 && graph.edges.length === 0) {
    return feeLabel
  }

  return feeLabel
}

/**
 * Sends a contract graph to the compile API and returns the WASM binary.
 */
export async function compileContract(graph: { nodes: Node[]; edges: Edge[] }): Promise<CompileResponse> {
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

export function decodeWasmBase64(wasmBase64: string): Uint8Array {
  if (typeof atob !== "function") {
    return Uint8Array.from(Buffer.from(wasmBase64, "base64"))
  }

  const binary = atob(wasmBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function asByteArray(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value) && value.every((entry) => Number.isInteger(entry))) {
    return Uint8Array.from(value as number[])
  }
  return null
}

export function extractWasmHash(returnValue?: xdr.ScVal): Uint8Array {
  if (!returnValue) {
    throw new Error("WASM upload succeeded but did not return a WASM hash.")
  }

  const bytes = asByteArray(scValToNative(returnValue))
  if (!bytes || bytes.length !== 32) {
    throw new Error("WASM upload returned an invalid WASM hash.")
  }

  return new Uint8Array(bytes)
}

export function extractContractId(returnValue?: xdr.ScVal): string {
  if (!returnValue) {
    throw new Error("Contract creation succeeded but did not return a contract ID.")
  }

  try {
    return Address.fromScVal(returnValue).toString()
  } catch {
    const nativeValue = scValToNative(returnValue)
    if (typeof nativeValue === "string" && nativeValue.startsWith("C")) {
      return nativeValue
    }
  }

  throw new Error("Contract creation returned an invalid contract ID.")
}

type SignedTransaction = ReturnType<typeof TransactionBuilder.fromXDR>
type SuccessfulTransactionResponse = Extract<
  SorobanRpc.Api.GetTransactionResponse,
  { status: SorobanRpc.Api.GetTransactionStatus.SUCCESS }
>

async function loadSourceAccount(
  rpcServer: SorobanRpc.Server,
  horizonServer: Horizon.Server,
  publicKey: string
): Promise<Account> {
  try {
    return await rpcServer.getAccount(publicKey)
  } catch {
    return horizonServer.loadAccount(publicKey)
  }
}

function buildSorobanTx(account: Account, passphrase: string, operation: xdr.Operation, fee = "100"): Transaction {
  return new TransactionBuilder(account, {
    fee,
    networkPassphrase: passphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build()
}

async function prepareSorobanTx(
  rpcServer: SorobanRpc.Server,
  account: Account,
  passphrase: string,
  operation: xdr.Operation
): Promise<Transaction> {
  const tx = buildSorobanTx(account, passphrase, operation)
  return rpcServer.prepareTransaction(tx)
}

async function signWithFreighter(
  tx: Transaction,
  network: StellarNetwork,
  publicKey: string,
  passphrase: string
): Promise<SignedTransaction> {
  const freighter = await import("@stellar/freighter-api")
  const signedXdr = await freighter.signTransaction(tx.toXDR(), {
    network: network === "mainnet" ? "PUBLIC" : "TESTNET",
    networkPassphrase: passphrase,
    accountToSign: publicKey,
  })

  return TransactionBuilder.fromXDR(signedXdr, passphrase)
}

function describeSendError(response: SorobanRpc.Api.SendTransactionResponse) {
  const diagnosticCount = response.diagnosticEvents?.length ?? 0
  const diagnostics = diagnosticCount > 0 ? ` ${diagnosticCount} diagnostic event(s) were returned by RPC.` : ""
  return `Soroban RPC returned ${response.status}.${diagnostics}`
}

async function waitForTransaction(
  rpcServer: SorobanRpc.Server,
  transactionHash: string,
  label: string
): Promise<SuccessfulTransactionResponse> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await rpcServer.getTransaction(transactionHash)

    if (response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return response
    }

    if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${label} failed on-chain. Check transaction ${transactionHash} for details.`)
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error(`${label} was submitted but was not confirmed within 60 seconds.`)
}

async function submitAndWait(
  rpcServer: SorobanRpc.Server,
  tx: SignedTransaction,
  label: string
): Promise<{ hash: string; response: SuccessfulTransactionResponse }> {
  const submitResponse = await rpcServer.sendTransaction(tx)

  if (submitResponse.status !== "PENDING" && submitResponse.status !== "DUPLICATE") {
    throw new Error(`${label} was not accepted. ${describeSendError(submitResponse)}`)
  }

  const response = await waitForTransaction(rpcServer, submitResponse.hash, label)
  return { hash: submitResponse.hash, response }
}

function randomSalt() {
  const salt = new Uint8Array(32)
  globalThis.crypto.getRandomValues(salt)
  return salt
}

/**
 * Compiles a contract graph, uploads the WASM, and creates a Soroban contract instance.
 */
export async function deployContract(
  graph: { nodes: Node[]; edges: Edge[] },
  network: StellarNetwork = "testnet"
): Promise<DeploymentResult> {
  const publicKey = await connectWallet()
  const compiled = await compileContract(graph)
  const wasmBytes = decodeWasmBase64(compiled.wasm)
  const config = getNetworkConfig(network)
  const rpcServer = new SorobanRpc.Server(config.rpcUrl)
  const horizonServer = new Horizon.Server(config.horizonUrl)

  const uploadAccount = await loadSourceAccount(rpcServer, horizonServer, publicKey)
  const uploadTx = await prepareSorobanTx(
    rpcServer,
    uploadAccount,
    config.passphrase,
    Operation.uploadContractWasm({ wasm: wasmBytes })
  )
  const signedUploadTx = await signWithFreighter(uploadTx, network, publicKey, config.passphrase)
  const uploadResult = await submitAndWait(rpcServer, signedUploadTx, "WASM upload")
  const wasmHashBytes = extractWasmHash(uploadResult.response.returnValue)
  const wasmHash = bytesToHex(wasmHashBytes)

  const createAccount = await loadSourceAccount(rpcServer, horizonServer, publicKey)
  const createTx = await prepareSorobanTx(
    rpcServer,
    createAccount,
    config.passphrase,
    Operation.createCustomContract({
      address: Address.fromString(publicKey),
      wasmHash: wasmHashBytes,
      salt: randomSalt(),
    })
  )
  const signedCreateTx = await signWithFreighter(createTx, network, publicKey, config.passphrase)
  const createResult = await submitAndWait(rpcServer, signedCreateTx, "Contract creation")
  const contractId = extractContractId(createResult.response.returnValue)

  return {
    network,
    contractId,
    contractUrl: getStellarExpertContractUrl(network, contractId),
    wasmHash,
    uploadTransactionHash: uploadResult.hash,
    createTransactionHash: createResult.hash,
    sizeBytes: compiled.sizeBytes,
    sourceHash: compiled.sourceHash,
  }
}
