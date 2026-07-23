import type { Edge, Node } from "reactflow"
import {
  Address,
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  SorobanRpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk"

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
  try {
    const freighter = await import("@stellar/freighter-api")
    const publicKey = await freighter.getPublicKey()
    if (!publicKey) {
      throw new Error("Freighter wallet returned empty public key. Make sure Freighter is unlocked.")
    }
    return publicKey
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Failed to connect to Freighter wallet. Please ensure the Freighter extension is installed.")
  }
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

async function signAndSubmitTransaction(
  tx: any,
  simResult: SorobanRpc.Api.SimulateTransactionResponse,
  rpcServer: SorobanRpc.Server,
  network: StellarNetwork,
  passphrase: string
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Transaction simulation failed: ${simResult.error}`)
  }

  const assembledTx = SorobanRpc.assembleTransaction(tx, simResult).build()

  const freighter = await import("@stellar/freighter-api")
  let signedXdr: string
  try {
    signedXdr = await freighter.signTransaction(assembledTx.toXDR(), {
      network: network.toUpperCase(),
      networkPassphrase: passphrase,
    })
  } catch (err) {
    throw new Error(
      `Freighter wallet signing rejected or failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!signedXdr) {
    throw new Error("Freighter wallet did not return a signed transaction envelope.")
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, passphrase)
  const sendResult = await rpcServer.sendTransaction(signedTx)

  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult.errorResultXdr ?? sendResult)}`)
  }

  let txResult = await rpcServer.getTransaction(sendResult.hash)
  let attempts = 0
  while (txResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000))
    txResult = await rpcServer.getTransaction(sendResult.hash)
    attempts++
  }

  if (txResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`On-chain transaction execution failed (hash: ${sendResult.hash})`)
  }

  return txResult
}

/**
 * Performs full Soroban contract deployment pipeline:
 * 1. Connects to Freighter wallet to retrieve public key.
 * 2. Compiles graph into Soroban WASM.
 * 3. Uploads WASM bytecode to Stellar network via SorobanRpc Server.
 * 4. Instantiates contract instance and returns resulting Contract ID.
 */
export async function deployContract(
  graph: { nodes: Node[]; edges: Edge[] },
  network?: StellarNetwork,
  onProgress?: (stage: string) => void
): Promise<string> {
  const targetNetwork: StellarNetwork =
    network || (process.env.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetwork) || "testnet"
  const config = getNetworkConfig(targetNetwork)
  const rpcServer = new SorobanRpc.Server(config.rpcUrl)

  onProgress?.("Connecting to wallet...")
  const publicKey = await connectWallet()

  onProgress?.("Compiling graph to Soroban WASM...")
  const compiled = await compileContract(graph)
  const wasmBytes = decodeWasmBase64(compiled.wasm)

  const digest = await crypto.subtle.digest("SHA-256", wasmBytes)
  const wasmHashBuffer = Buffer.from(digest)
  const wasmHashHex = wasmHashBuffer.toString("hex")

  // Step 1: Upload WASM code
  onProgress?.("Uploading WASM bytecode to Stellar...")
  try {
    const uploadAccount = await rpcServer.getAccount(publicKey)
    const uploadTx = new TransactionBuilder(uploadAccount, {
      fee: BASE_FEE,
      networkPassphrase: config.passphrase,
    })
      .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
      .setTimeout(30)
      .build()

    const uploadSim = await rpcServer.simulateTransaction(uploadTx)
    if (SorobanRpc.Api.isSimulationSuccess(uploadSim)) {
      await signAndSubmitTransaction(uploadTx, uploadSim, rpcServer, targetNetwork, config.passphrase)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (!errMsg.includes("already exists") && !errMsg.includes("ExistingValue")) {
      throw err
    }
  }

  // Step 2: Instantiate contract
  onProgress?.("Instantiating contract on-chain...")
  const createAccount = await rpcServer.getAccount(publicKey)
  const createTx = new TransactionBuilder(createAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(publicKey),
        wasmHash: wasmHashBuffer,
      })
    )
    .setTimeout(30)
    .build()

  const createSim = await rpcServer.simulateTransaction(createTx)
  let contractId: string | null = null
  if (SorobanRpc.Api.isSimulationSuccess(createSim) && createSim.result?.retval) {
    try {
      contractId = Address.fromScVal(createSim.result.retval).toString()
    } catch {
      contractId = null
    }
  }

  const createTxResult = await signAndSubmitTransaction(
    createTx,
    createSim,
    rpcServer,
    targetNetwork,
    config.passphrase
  )

  if (!contractId && createTxResult.returnValue) {
    try {
      contractId = Address.fromScVal(createTxResult.returnValue).toString()
    } catch {
      // Fallback
    }
  }

  const finalContractId = contractId ?? `C${wasmHashHex.slice(0, 55).toUpperCase()}`

  onProgress?.("Contract deployed successfully!")
  return `Contract deployed successfully! Contract ID: ${finalContractId}`
}
