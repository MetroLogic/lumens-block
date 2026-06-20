import type { Node, Edge } from "reactflow"

export interface ContractGraph {
  nodes: Node[]
  edges: Edge[]
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
 * Deploys a contract graph to Stellar Testnet.
 * Requires a connected wallet public key.
 * Stub — full Soroban deployment logic goes here.
 */
export async function deployContract(
  graph: ContractGraph,
  publicKey: string
): Promise<string> {
  console.log("Deploying contract for", publicKey, graph)
  // TODO: compile graph → WASM, upload to Stellar, invoke contract creation
  throw new Error("Deployment not yet implemented")
}
