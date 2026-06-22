import type { Edge, Node } from "reactflow"
import { Contract, SorobanRpc, xdr } from "@stellar/stellar-sdk"

import { getNetworkConfig, type StellarNetwork } from "@/lib/stellar/deploy"

export type ContractInspectorStatus = "ready" | "missing" | "invalid" | "rpc-error"

export interface ContractInspectorMethod {
  name: string
  inputs: string[]
  outputs: string[]
  doc?: string
}

export interface ContractInspectorStorageEntry {
  key: string
  value: string
}

export interface ContractInspectorResult {
  status: ContractInspectorStatus
  contractId: string
  network: StellarNetwork
  latestLedger?: number
  error?: string
  wasmHash?: string
  executableType?: string
  createdLedger?: number
  liveUntilLedgerSeq?: number
  storageEntries: ContractInspectorStorageEntry[]
  methods: ContractInspectorMethod[]
  rawDetails: Record<string, string | number | null>
}

export interface InspectorGraph {
  nodes: Node[]
  edges: Edge[]
}

export function validateContractId(contractId: string): { ok: true } | { ok: false; message: string } {
  try {
    new Contract(contractId)
    return { ok: true }
  } catch {
    return {
      ok: false,
      message: "Enter a valid Stellar contract ID that starts with C.",
    }
  }
}

export async function inspectContract(
  contractId: string,
  network: StellarNetwork = "testnet"
): Promise<ContractInspectorResult> {
  const validation = validateContractId(contractId)
  if (!validation.ok) {
    return emptyResult(contractId, network, "invalid", validation.message)
  }

  const contract = new Contract(contractId)
  const server = new SorobanRpc.Server(getNetworkConfig(network).rpcUrl)

  try {
    const instanceResponse = await server.getLedgerEntries(contract.getFootprint())
    const instanceEntry = instanceResponse.entries[0]

    if (!instanceEntry) {
      return emptyResult(
        contractId,
        network,
        "missing",
        "No contract instance was found on this network.",
        instanceResponse.latestLedger
      )
    }

    const contractData = instanceEntry.val.contractData()
    const instance = contractData.val().instance()
    const executable = instance.executable()
    const executableType = executable.switch().name
    const storageEntries = storageMapToDetails(instance.storage())
    const wasmHash = executableType === "contractExecutableWasm" ? executable.wasmHash().toString("hex") : undefined
    const codeEntry = wasmHash ? await fetchContractCode(server, wasmHash) : null
    const methods = codeEntry ? parseContractSpecMethods(codeEntry.code) : []

    return {
      status: "ready",
      contractId,
      network,
      latestLedger: instanceResponse.latestLedger,
      wasmHash,
      executableType,
      createdLedger: instanceEntry.lastModifiedLedgerSeq,
      liveUntilLedgerSeq: instanceEntry.liveUntilLedgerSeq,
      storageEntries,
      methods,
      rawDetails: {
        "Contract ID": contractId,
        Network: network,
        "Latest ledger": instanceResponse.latestLedger,
        "Executable type": executableType,
        "WASM hash": wasmHash ?? null,
        "Instance key XDR": instanceEntry.key.toXDR("base64"),
        "Instance value XDR": instanceEntry.val.toXDR("base64"),
        "Code key XDR": codeEntry?.keyXdr ?? null,
        "Code size bytes": codeEntry?.code.length ?? null,
        "Last modified ledger": instanceEntry.lastModifiedLedgerSeq ?? null,
        "Live until ledger": instanceEntry.liveUntilLedgerSeq ?? null,
      },
    }
  } catch (error) {
    return emptyResult(
      contractId,
      network,
      "rpc-error",
      error instanceof Error ? error.message : "Unable to load contract details from Stellar RPC."
    )
  }
}

export function buildInspectorGraph(result: Pick<ContractInspectorResult, "methods" | "storageEntries" | "wasmHash">): InspectorGraph {
  const nodes: Node[] = [
    {
      id: "contract",
      type: "inspector",
      position: { x: 80, y: 120 },
      data: {
        label: "Contract",
        caption: result.wasmHash ? shortHash(result.wasmHash) : "Stellar asset contract",
        tone: "contract",
      },
      draggable: false,
    },
  ]
  const edges: Edge[] = []

  const methodNodes = result.methods.length > 0 ? result.methods : [{ name: "No exported methods found", inputs: [], outputs: [] }]
  methodNodes.forEach((method, index) => {
    const id = `method-${index}`
    nodes.push({
      id,
      type: "inspector",
      position: { x: 380, y: 40 + index * 130 },
      data: {
        label: method.name,
        caption: formatMethodSignature(method),
        tone: "method",
      },
      draggable: false,
    })
    edges.push({
      id: `contract-${id}`,
      source: "contract",
      target: id,
      animated: false,
      label: "method",
    })
  })

  const storageNodes =
    result.storageEntries.length > 0
      ? result.storageEntries
      : [{ key: "No instance storage entries", value: "Persistent contract data may still exist outside the instance map." }]

  storageNodes.forEach((entry, index) => {
    const id = `storage-${index}`
    nodes.push({
      id,
      type: "inspector",
      position: { x: 720, y: 80 + index * 120 },
      data: {
        label: entry.key,
        caption: truncateMiddle(entry.value, 54),
        tone: "storage",
      },
      draggable: false,
    })
    edges.push({
      id: `contract-${id}`,
      source: "contract",
      target: id,
      animated: false,
      label: "storage",
    })
  })

  return { nodes, edges }
}

export function parseContractSpecMethods(wasm: Uint8Array): ContractInspectorMethod[] {
  const section = findWasmCustomSection(wasm, "contractspecv0")
  if (!section) return []

  const methods: ContractInspectorMethod[] = []
  let offset = 0

  while (offset < section.length) {
    let parsed: xdr.ScSpecEntry | null = null
    for (let length = 4; offset + length <= section.length; length += 4) {
      const chunk = section.subarray(offset, offset + length)
      try {
        parsed = xdr.ScSpecEntry.fromXDR(Buffer.from(chunk))
        offset += length
        break
      } catch {
        parsed = null
      }
    }

    if (!parsed) break
    if (parsed.switch().value !== xdr.ScSpecEntryKind.scSpecEntryFunctionV0().value) continue

    const fn = parsed.functionV0()
    methods.push({
      name: bufferToString(fn.name()),
      doc: bufferToString(fn.doc()) || undefined,
      inputs: fn.inputs().map((input) => `${bufferToString(input.name())}: ${formatSpecType(input.type())}`),
      outputs: fn.outputs().map(formatSpecType),
    })
  }

  return methods
}

function emptyResult(
  contractId: string,
  network: StellarNetwork,
  status: ContractInspectorStatus,
  error: string,
  latestLedger?: number
): ContractInspectorResult {
  return {
    status,
    contractId,
    network,
    latestLedger,
    error,
    storageEntries: [],
    methods: [],
    rawDetails: {
      "Contract ID": contractId,
      Network: network,
      "Latest ledger": latestLedger ?? null,
      Error: error,
    },
  }
}

async function fetchContractCode(
  server: SorobanRpc.Server,
  wasmHash: string
): Promise<{ code: Buffer; keyXdr: string } | null> {
  const key = xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({
      hash: Buffer.from(wasmHash, "hex"),
    })
  )
  const response = await server.getLedgerEntries(key)
  const entry = response.entries[0]

  if (!entry) return null

  return {
    code: entry.val.contractCode().code(),
    keyXdr: entry.key.toXDR("base64"),
  }
}

function storageMapToDetails(storage: xdr.ScMapEntry[] | null): ContractInspectorStorageEntry[] {
  return (storage ?? []).map((entry) => ({
    key: formatScVal(entry.key()),
    value: formatScVal(entry.val()),
  }))
}

function formatScVal(value: xdr.ScVal): string {
  const kind = value.switch().name

  switch (kind) {
    case "scvBool":
      return String(value.b())
    case "scvVoid":
    case "scvLedgerKeyContractInstance":
      return kind
    case "scvU32":
      return String(value.u32())
    case "scvI32":
      return String(value.i32())
    case "scvU64":
      return value.u64().toString()
    case "scvI64":
      return value.i64().toString()
    case "scvString":
      return bufferToString(value.str())
    case "scvSymbol":
      return bufferToString(value.sym())
    case "scvBytes":
      return `0x${value.bytes().toString("hex")}`
    case "scvVec":
      return `[${(value.vec() ?? []).map(formatScVal).join(", ")}]`
    case "scvMap":
      return `{${(value.map() ?? [])
        .map((entry) => `${formatScVal(entry.key())}: ${formatScVal(entry.val())}`)
        .join(", ")}}`
    case "scvAddress": {
      const address = value.address()
      return `${address.switch().name}:${Buffer.from(address.value() as Buffer).toString("hex")}`
    }
    case "scvContractInstance":
      return "Contract instance"
    default:
      return `${kind}:${value.toXDR("base64")}`
  }
}

function findWasmCustomSection(wasm: Uint8Array, name: string): Uint8Array | null {
  if (wasm.length < 8 || wasm[0] !== 0 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) return null

  let offset = 8
  while (offset < wasm.length) {
    const sectionId = wasm[offset++]
    const sectionSize = readUleb128(wasm, offset)
    offset = sectionSize.nextOffset
    const sectionEnd = offset + sectionSize.value

    if (sectionEnd > wasm.length) return null

    if (sectionId === 0) {
      const nameSize = readUleb128(wasm, offset)
      offset = nameSize.nextOffset
      const sectionName = bufferToString(wasm.subarray(offset, offset + nameSize.value))
      offset += nameSize.value

      if (sectionName === name) {
        return wasm.subarray(offset, sectionEnd)
      }
    }

    offset = sectionEnd
  }

  return null
}

function readUleb128(bytes: Uint8Array, start: number): { value: number; nextOffset: number } {
  let result = 0
  let shift = 0
  let offset = start

  while (offset < bytes.length) {
    const byte = bytes[offset++]
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      return { value: result, nextOffset: offset }
    }
    shift += 7
  }

  throw new Error("Invalid LEB128 sequence")
}

function formatSpecType(typeDef: xdr.ScSpecTypeDef): string {
  const kind = typeDef.switch().name.replace(/^scSpecType/, "")

  switch (typeDef.switch().value) {
    case xdr.ScSpecType.scSpecTypeOption().value:
      return `${formatSpecType(typeDef.option().valueType())}?`
    case xdr.ScSpecType.scSpecTypeResult().value:
      return `Result<${formatSpecType(typeDef.result().okType())}, ${formatSpecType(typeDef.result().errorType())}>`
    case xdr.ScSpecType.scSpecTypeVec().value:
      return `Vec<${formatSpecType(typeDef.vec().elementType())}>`
    case xdr.ScSpecType.scSpecTypeMap().value:
      return `Map<${formatSpecType(typeDef.map().keyType())}, ${formatSpecType(typeDef.map().valueType())}>`
    case xdr.ScSpecType.scSpecTypeTuple().value:
      return `(${typeDef.tuple().valueTypes().map(formatSpecType).join(", ")})`
    case xdr.ScSpecType.scSpecTypeBytesN().value:
      return `BytesN<${typeDef.bytesN().n()}>`
    case xdr.ScSpecType.scSpecTypeUdt().value:
      return bufferToString(typeDef.udt().name())
    default:
      return kind
  }
}

function formatMethodSignature(method: ContractInspectorMethod): string {
  const args = method.inputs.length > 0 ? method.inputs.join(", ") : "no inputs"
  const returns = method.outputs.length > 0 ? method.outputs.join(", ") : "void"
  return `${args} -> ${returns}`
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const half = Math.floor((maxLength - 3) / 2)
  return `${value.slice(0, half)}...${value.slice(-half)}`
}

function bufferToString(value: string | Buffer | Uint8Array): string {
  return typeof value === "string" ? value : Buffer.from(value).toString("utf8")
}
