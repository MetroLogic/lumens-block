import {
  BASE_FEE,
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk"

import type { TokenMetadata } from "./assets"
import { validateTransferAssetSelection } from "./assets"

export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org"
const METADATA_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"

function nativeMetadataValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object" && "toString" in value) {
    const rendered = String(value)
    return rendered === "[object Object]" ? undefined : rendered
  }

  return undefined
}

async function readTokenMetadataField(
  server: SorobanRpc.Server,
  source: Awaited<ReturnType<SorobanRpc.Server["getAccount"]>>,
  token: string,
  field: "symbol" | "name"
): Promise<string | undefined> {
  const contract = new Contract(token)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(field))
    .setTimeout(30)
    .build()

  const result = await server.simulateTransaction(tx)

  if (!SorobanRpc.Api.isSimulationSuccess(result)) {
    return undefined
  }

  const value = result.result?.retval ? scValToNative(result.result.retval) : undefined
  return nativeMetadataValue(value)
}

export async function fetchSacTokenMetadataFromRpc(
  token: string,
  rpcUrl = TESTNET_RPC_URL
): Promise<TokenMetadata> {
  const validation = validateTransferAssetSelection({ assetType: "sac", token })
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: false })
  const source = await server.getAccount(METADATA_SOURCE)

  const [symbol, name] = await Promise.all([
    readTokenMetadataField(server, source, token, "symbol"),
    readTokenMetadataField(server, source, token, "name"),
  ])

  return {
    ...(symbol ? { symbol } : {}),
    ...(name ? { name } : {}),
  }
}
