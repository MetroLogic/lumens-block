import type { Node, Edge } from "reactflow"

export interface ContractGraph {
  nodes: Node[]
  edges: Edge[]
}

/**
 * Connects to Freighter wallet and returns the user's public key.
 */
export async function connectWallet(): Promise<string> {
  const freighter = await import("@stellar/freighter-api")
  const publicKey = await freighter.getPublicKey()
  return publicKey
}

/**
 * Deploys a contract graph to Stellar Testnet.
 * Stub — full Soroban deployment logic goes here.
 */
export async function deployContract(graph: ContractGraph): Promise<string> {
  const publicKey = await connectWallet()
  console.log("Deploying contract for", publicKey, graph)
  // TODO: compile graph → WASM, upload to Stellar, invoke contract creation
  throw new Error("Deployment not yet implemented")
}
