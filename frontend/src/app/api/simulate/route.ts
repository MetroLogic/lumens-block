import { NextRequest, NextResponse } from "next/server"
import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk"
import type { SimulateArg, SimulateEvent, SimulateResult, ResourceUsage } from "@/lib/stellar/simulate"
import type { ContractGraph } from "@/lib/stellar/deploy"

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Stellar Testnet RPC endpoint.
 * Override via STELLAR_RPC_URL env var in production.
 */
const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org"

/**
 * A throw-away testnet keypair used only as the transaction source for simulation.
 * Simulation never requires signing or submitting, so this is safe.
 */
const SIMULATION_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"

// ─── Graph → Soroban argument conversion ─────────────────────────────────────

type NodeType = "default" | "Auth" | "Transfer" | "Storage" | "Event" | "Condition"

/**
 * Derives the entry-point function name from the node graph topology.
 * Walks the node types from start to find the dominant operation.
 */
function inferFunctionName(graph: ContractGraph): string {
  const types = graph.nodes.map((n) => n.type as NodeType)
  if (types.includes("Transfer")) return "transfer"
  if (types.includes("Storage")) return "set_value"
  if (types.includes("Event")) return "emit_event"
  if (types.includes("Condition")) return "evaluate"
  return "hello"
}

/**
 * Converts a SimulateArg value string to an xdr.ScVal for the Soroban call.
 */
function argToScVal(arg: SimulateArg): xdr.ScVal {
  const { type, value } = arg

  if (type === "address") {
    // nativeToScVal handles Stellar G-addresses
    return nativeToScVal(value, { type: "address" })
  }

  if (type === "number") {
    const num = Number(value)
    if (isNaN(num)) return nativeToScVal(0, { type: "i128" })
    return nativeToScVal(BigInt(Math.trunc(num)), { type: "i128" })
  }

  if (type === "boolean") {
    return nativeToScVal(value.toLowerCase() === "true", { type: "bool" })
  }

  // Default: string → Symbol if short, otherwise Bytes
  if (value.length <= 32) {
    return nativeToScVal(value, { type: "symbol" })
  }
  return nativeToScVal(value, { type: "string" })
}

// ─── Event parsing ────────────────────────────────────────────────────────────

function parseEvents(rawEvents: xdr.DiagnosticEvent[]): SimulateEvent[] {
  if (!rawEvents || rawEvents.length === 0) return []

  return rawEvents.map((ev) => {
    let type = "contract"
    let topics: string[] = []
    let data = ""

    try {
      const contractEvent = ev.event()
      type = contractEvent.type().name ?? "contract"
      topics = contractEvent.body().v0().topics().map((t: xdr.ScVal) => scValToString(t))
      data = scValToString(contractEvent.body().v0().data())
    } catch {
      data = "(unparseable event)"
    }

    return { type, topics, data }
  })
}

function scValToString(val: xdr.ScVal): string {
  try {
    const t = val.switch().name
    if (t === "scvSymbol") return val.sym().toString()
    if (t === "scvString") return val.str().toString()
    if (t === "scvI128") {
      const hi = BigInt(val.i128().hi().toString())
      const lo = BigInt(val.i128().lo().toString())
      return String((hi << BigInt(64)) | lo)
    }
    if (t === "scvU128") {
      const hi = BigInt(val.u128().hi().toString())
      const lo = BigInt(val.u128().lo().toString())
      return String((hi << BigInt(64)) | lo)
    }
    if (t === "scvBool") return String(val.b())
    if (t === "scvAddress") return val.address().toString()
    if (t === "scvVoid") return "(void)"
    return val.toXDR("base64").slice(0, 64)
  } catch {
    return "(unparseable)"
  }
}

// ─── Resource extraction ──────────────────────────────────────────────────────

function extractResources(
  sim: SorobanRpc.Api.SimulateTransactionSuccessResponse
): ResourceUsage {
  const cost = sim.cost
  const sorobanData = sim.transactionData

  let readBytes = 0
  let writeBytes = 0
  let readEntries = 0
  let writeEntries = 0

  try {
    const resources = sorobanData.build().resources()
    readBytes = resources.readBytes()
    writeBytes = resources.writeBytes()
    // footprint entries
    const footprint = resources.footprint()
    readEntries = footprint.readOnly().length
    writeEntries = footprint.readWrite().length
  } catch {
    // Older SDK or unexpected shape — leave zeros
  }

  return {
    instructions: Number(cost?.cpuInsns ?? 0),
    memBytes: Number(cost?.memBytes ?? 0),
    readBytes,
    writeBytes,
    readEntries,
    writeEntries,
  }
}

// ─── Request / response types ─────────────────────────────────────────────────

interface SimulateRequestBody {
  graph: ContractGraph
  args: SimulateArg[]
  /** Optional deployed contract ID on testnet to invoke. If absent we use a placeholder. */
  contractId?: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SimulateRequestBody

  try {
    body = (await req.json()) as SimulateRequestBody
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { graph, args, contractId } = body

  if (!graph || !Array.isArray(graph.nodes)) {
    return NextResponse.json({ error: "Missing or invalid graph" }, { status: 400 })
  }

  try {
    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false })
    const sourceAccount = await server.getAccount(SIMULATION_SOURCE)

    const functionName = inferFunctionName(graph)

    // Build Soroban call args from provided input
    const scArgs = args.map(argToScVal)

    // If no real contract ID is provided, use a dummy placeholder.
    // The simulation will fail gracefully with a "not found" error,
    // which we surface back to the user — still exercising the full pipeline.
    const targetContractId =
      contractId ?? "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"

    const contract = new Contract(targetContractId)

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(functionName, ...scArgs))
      .setTimeout(30)
      .build()

    const simResult = await server.simulateTransaction(tx)

    // ── Success path ─────────────────────────────────────────────
    if (SorobanRpc.Api.isSimulationSuccess(simResult)) {
      const returnVal = simResult.result?.retval
      const returnValue = returnVal ? scValToString(returnVal) : undefined
      const events = parseEvents(simResult.events ?? [])
      const resources = extractResources(simResult)

      const result: SimulateResult = {
        success: true,
        returnValue,
        events,
        resources,
      }

      return NextResponse.json(result)
    }

    // ── Error path ────────────────────────────────────────────────
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      const errMsg: string = simResult.error ?? "Unknown simulation error"

      // Try to extract a structured error code (e.g. "Error(Contract, #1)")
      const codeMatch = errMsg.match(/Error\([^)]+\)/)
      const errorCode = codeMatch ? codeMatch[0] : undefined

      const result: SimulateResult = {
        success: false,
        events: [],
        resources: {
          instructions: 0,
          memBytes: 0,
          readBytes: 0,
          writeBytes: 0,
          readEntries: 0,
          writeEntries: 0,
        },
        error: errMsg,
        errorCode,
      }

      return NextResponse.json(result)
    }

    // ── Restore path (shouldn't normally occur for pure simulation) ──
    return NextResponse.json(
      { error: "Unexpected simulation response (restore required)" },
      { status: 400 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[simulate] Error:", message)
    return NextResponse.json(
      { error: `Simulation failed: ${message}` },
      { status: 500 }
    )
  }
}
