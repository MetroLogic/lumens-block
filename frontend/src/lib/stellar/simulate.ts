import type { Edge, Node } from "reactflow"

import type { TransferAsset } from "@/lib/compile/schema"
import { normalizeReactFlowGraph } from "@/lib/compile/validate"

function resolveTransferToken(params: { asset?: TransferAsset; token?: string } | undefined): string {
  return params?.asset?.contractId ?? params?.token ?? ""
}

export interface SimulateArg {
  name: string
  type: "string" | "number" | "address" | "boolean"
  value: string
}

export interface SimulateRequest {
  graph: { nodes: Node[]; edges: Edge[] }
  args: SimulateArg[]
  contractId?: string
}

export interface SimulateEvent {
  type: string
  topics: string[]
  data: string
}

export interface ResourceUsage {
  instructions: number
  readBytes: number
  writeBytes: number
  readEntries: number
  writeEntries: number
  memBytes: number
}

export interface SimulateResult {
  success: boolean
  returnValue?: string
  events: SimulateEvent[]
  resources: ResourceUsage
  error?: string
  errorCode?: string
}

/**
 * Calls the backend POST /api/simulate with the current graph and invocation args.
 * Returns structured simulation results without submitting a transaction to the chain.
 */
export async function simulateContract(req: SimulateRequest): Promise<SimulateResult> {
  const payload = {
    graph: normalizeReactFlowGraph(req.graph),
    args: req.args,
    ...(req.contractId ? { contractId: req.contractId } : {}),
  }

  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Simulate API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<SimulateResult>
}

/**
 * Infer invocation arguments from the node graph.
 * Inspects node types to suggest relevant parameter names/types.
 */
export function inferArgsFromGraph(graph: { nodes: Node[]; edges: Edge[] }): SimulateArg[] {
  const normalized = normalizeReactFlowGraph(graph)
  const args: SimulateArg[] = []
  const seen = new Set<string>()
  let transferTokenDefault = ""

  const add = (name: string, type: SimulateArg["type"], value = "") => {
    if (!seen.has(name)) {
      seen.add(name)
      args.push({ name, type, value })
    }
  }

  for (const node of normalized.nodes) {
    switch (node.type) {
      case "Transfer": {
        add("from", "address")
        add("to", "address")
        add("amount", "number")
        if (!transferTokenDefault) {
          transferTokenDefault = resolveTransferToken(node.data.params)
        }
        add("token", "address", transferTokenDefault)
        break
      }
      case "Auth":
        add("caller", "address")
        break
      case "Storage":
        add("key", "string")
        add("value", "string")
        break
      case "Condition":
        add("condition_input", "string")
        break
      case "Event":
        add("event_data", "string")
        break
    }
  }

  // Always include a generic invoker if nothing was inferred
  if (args.length === 0) {
    add("input", "string")
  }

  return args
}
