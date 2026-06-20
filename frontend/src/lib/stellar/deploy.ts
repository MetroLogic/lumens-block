import type { Edge, Node } from "reactflow"

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

/**
 * Checks whether the Freighter browser extension is installed.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const freighter = await import("@stellar/freighter-api")
    return await freighter.isConnected()
  } catch {
    return false
  }
}

/**
 * Connects to Freighter wallet and returns the user's public key.
 * Uses the Freighter API v2 methods: requestAccess() + getAddress().
 */
export async function connectWallet(): Promise<string> {
  const freighter = await import("@stellar/freighter-api")

  const connected = await freighter.isConnected()
  if (!connected) {
    throw new Error(
      "Freighter extension is not installed. Visit https://freighter.app to install it."
    )
  }

  await freighter.requestAccess()

  const pubKey = await freighter.getPublicKey()

  if (typeof pubKey === "string" && pubKey) {
    return pubKey
  }

  throw new Error("Could not retrieve public key from Freighter")
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
export async function deployContract(graph: {
  nodes: Node[]
  edges: Edge[]
}): Promise<string> {
  const publicKey = await connectWallet()
  const compiled = await compileContract(graph)
  const wasmBytes = decodeWasmBase64(compiled.wasm)

  const digest = await crypto.subtle.digest("SHA-256", wasmBytes)
  const hashHex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return `WASM compiled (${compiled.sizeBytes} bytes, hash ${hashHex.slice(0, 16)}) for ${publicKey.slice(0, 8)}…`
}
