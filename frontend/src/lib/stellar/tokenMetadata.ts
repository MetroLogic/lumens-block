import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  StrKey,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk"

import type { TransferAsset } from "@/lib/compile/schema"
import { getNetworkConfig } from "@/lib/stellar/deploy"

/** Throwaway source for read-only simulation — never signed or submitted. */
function simulationSourceAccount(): Account {
  return new Account(Keypair.random().publicKey(), "0")
}

/**
 * Returns true when `address` is a well-formed Stellar contract (C…) address.
 */
export function isValidContractAddress(address: string): boolean {
  const trimmed = address.trim()
  if (!trimmed) return false
  try {
    // stellar-sdk 12 runtime exposes isValidContract; typings may lag behind.
    const strKey = StrKey as typeof StrKey & {
      isValidContract: (value: string) => boolean
    }
    return strKey.isValidContract(trimmed)
  } catch {
    return false
  }
}

/**
 * Native XLM as a TransferAsset for Testnet (deterministic SAC contract id).
 */
export function getNativeXlmAsset(): TransferAsset {
  const contractId = Asset.native().contractId(Networks.TESTNET)
  return {
    kind: "xlm",
    contractId,
    symbol: "XLM",
    name: "native",
  }
}

function scValToDisplayString(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "string") return val
  if (typeof val === "symbol") return val.toString()
  // stellar-sdk may return Buffer-like or object wrappers for String/Symbol
  if (typeof val === "object" && val !== null && "toString" in val) {
    return String((val as { toString: () => string }).toString())
  }
  return String(val)
}

async function simulateContractRead(
  contractId: string,
  functionName: "symbol" | "name"
): Promise<string> {
  const { rpcUrl, passphrase } = getNetworkConfig("testnet")
  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: false })
  const contract = new Contract(contractId)
  const tx = new TransactionBuilder(simulationSourceAccount(), {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(functionName))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error ?? `Failed to call ${functionName} on contract`)
  }

  if (!SorobanRpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error(`No result from ${functionName} on contract`)
  }

  return scValToDisplayString(scValToNative(sim.result.retval)).trim()
}

export class TokenMetadataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TokenMetadataError"
  }
}

/**
 * Fetches SEP-41 `symbol` and `name` from a SAC (or token) contract on Testnet.
 */
export async function fetchTokenMetadata(
  contractId: string
): Promise<{ symbol: string; name: string }> {
  const trimmed = contractId.trim()

  if (!isValidContractAddress(trimmed)) {
    throw new TokenMetadataError("Invalid contract address")
  }

  try {
    const [symbol, name] = await Promise.all([
      simulateContractRead(trimmed, "symbol"),
      simulateContractRead(trimmed, "name"),
    ])

    if (!symbol && !name) {
      throw new TokenMetadataError("Contract did not return token metadata")
    }

    return {
      symbol: symbol || "UNKNOWN",
      name: name || symbol || "UNKNOWN",
    }
  } catch (err) {
    if (err instanceof TokenMetadataError) throw err
    const message = err instanceof Error ? err.message : String(err)
    if (/not found|does not exist|missing|unreachable/i.test(message)) {
      throw new TokenMetadataError("Contract not found on Testnet")
    }
    throw new TokenMetadataError(
      message.includes("Failed to call") || message.includes("No result")
        ? "Not a valid SAC token contract"
        : `Unable to fetch token metadata: ${message}`
    )
  }
}
