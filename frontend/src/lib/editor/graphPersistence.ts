import type { Edge, Node } from "reactflow"
import type { ContractGraph } from "@/lib/compile/schema"
import { normalizeReactFlowGraph, validateContractGraph } from "@/lib/compile/validate"

export const GRAPH_STORAGE_KEY = "lumens-block:graph"
export const DEPLOYED_GRAPH_STORAGE_KEY = "lumens-block:deployedGraph"
export const GRAPH_EXPORT_FILENAME = "contract-graph.json"
export const GRAPH_AUTOSAVE_DEBOUNCE_MS = 500

export const EMPTY_GRAPH_NODES: Node[] = [
  {
    id: "1",
    type: "default",
    position: { x: 250, y: 150 },
    data: { label: "Start" },
  },
]

/** Serialize React Flow state into the ContractGraph schema (includes positions). */
export function toContractGraph(nodes: Node[], edges: Edge[]): ContractGraph {
  return normalizeReactFlowGraph({ nodes, edges })
}

/** Convert a validated ContractGraph into React Flow nodes/edges. */
export function toReactFlowGraph(graph: ContractGraph): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: node.position ?? { x: 250, y: 80 + index * 100 },
      data: node.data,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
    })),
  }
}

export function saveGraphToStorage(graph: ContractGraph): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(graph))
  } catch {
    // Quota exceeded or private browsing — ignore; export still works.
  }
}

export function loadGraphFromStorage(): ContractGraph | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    const result = validateContractGraph(parsed, undefined, { skipStructureValidation: true })
    return result.ok ? result.graph : null
  } catch {
    return null
  }
}

export function clearGraphStorage(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(GRAPH_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Persist the graph exactly as it was deployed, under a separate key from the
 * canvas autosave so the last-deployed snapshot can be diffed against later.
 */
export function saveDeployedSnapshot(graph: ContractGraph): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DEPLOYED_GRAPH_STORAGE_KEY, JSON.stringify(graph))
  } catch {
    // Quota exceeded or private browsing — ignore; the diff check degrades gracefully.
  }
}

/**
 * Load the last-deployed graph snapshot, or null when nothing has been
 * deployed yet (first deploy) or the stored value is unreadable.
 */
export function loadDeployedSnapshot(): ContractGraph | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(DEPLOYED_GRAPH_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    const result = validateContractGraph(parsed, undefined, { skipStructureValidation: true })
    return result.ok ? result.graph : null
  } catch {
    return null
  }
}

export function downloadGraphJson(graph: ContractGraph): void {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = GRAPH_EXPORT_FILENAME
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function parseImportedGraphJson(
  text: string
): { ok: true; graph: ContractGraph } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: "Invalid JSON file. Please choose a valid contract-graph.json export.",
    }
  }

  const byteLength = new TextEncoder().encode(text).length
  const result = validateContractGraph(parsed, byteLength, { skipStructureValidation: true })

  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message || "This file is not a valid contract graph.",
    }
  }

  return { ok: true, graph: result.graph }
}
