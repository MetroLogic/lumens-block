import type { Edge, Node } from "reactflow"

import type { CompileError, ContractGraph } from "@/lib/compile/schema"
import { normalizeReactFlowGraph, validateStoredContractGraph } from "@/lib/compile/validate"

export const GRAPH_STORAGE_KEY = "lumens-block:graph"
export const GRAPH_EXPORT_FILE_NAME = "contract-graph.json"

export type GraphValidationResult =
  | { ok: true; graph: ContractGraph }
  | { ok: false; error: CompileError }

export function serializeReactFlowGraph(nodes: Node[], edges: Edge[]): ContractGraph {
  return normalizeReactFlowGraph({ nodes, edges })
}

export function graphToReactFlow(graph: ContractGraph): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: node.position ?? { x: 250, y: 150 + index * 120 },
      data: node.data,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  }
}

export function validateGraphJsonText(text: string): GraphValidationResult {
  try {
    const raw = JSON.parse(text) as unknown
    const byteLength = new TextEncoder().encode(text).length
    return validateStoredContractGraph(raw, byteLength)
  } catch {
    return {
      ok: false,
      error: {
        code: "MALFORMED_JSON",
        message: "The selected file is not valid JSON.",
      },
    }
  }
}

export function graphToJson(nodes: Node[], edges: Edge[]): string {
  return `${JSON.stringify(serializeReactFlowGraph(nodes, edges), null, 2)}\n`
}

export function readStoredGraph(storage: Storage): GraphValidationResult | null {
  const raw = storage.getItem(GRAPH_STORAGE_KEY)
  if (!raw) return null
  return validateGraphJsonText(raw)
}

export function writeStoredGraph(storage: Storage, nodes: Node[], edges: Edge[]) {
  storage.setItem(GRAPH_STORAGE_KEY, graphToJson(nodes, edges))
}
