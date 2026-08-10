import type { Edge, Node } from "reactflow"
import type { ContractGraph } from "@/lib/compile/schema"
import { normalizeReactFlowGraph, validateContractGraph } from "@/lib/compile/validate"

export const GRAPH_STORAGE_KEY = "lumens-block:graph"
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

// ──────────────────────────────────────────────
// Shareable read-only graph URL (Issue #22)
// ──────────────────────────────────────────────

export const GRAPH_URL_PARAM = "graph"

/**
 * Serialize a ContractGraph into a URL-safe base64 string.
 * The graph is JSON-stringified, then base64-encoded via btoa.
 * For large graphs, the encoded string is further URI-encoded so it
 * survives query-parameter transport.
 */
export function encodeGraphToUrlParam(graph: ContractGraph): string {
  const json = JSON.stringify(graph)
  // Use btoa with Unicode support via encodeURIComponent workaround
  const base64 = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ))
  return base64
}

/**
 * Decode a base64 URL param back into a ContractGraph.
 * Returns null on parse failure or validation failure.
 */
export function decodeGraphFromUrlParam(param: string): ContractGraph | null {
  try {
    const json = decodeURIComponent(
      atob(param)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const parsed: unknown = JSON.parse(json)
    const byteLength = new TextEncoder().encode(json).length
    const result = validateContractGraph(parsed, byteLength, { skipStructureValidation: true })
    return result.ok ? result.graph : null
  } catch {
    return null
  }
}

/**
 * Build a shareable URL containing the current graph state and copy it to the clipboard.
 * Returns the URL string on success, or null if the operation failed.
 */
export function copyShareUrlToClipboard(graph: ContractGraph): string | null {
  if (typeof window === "undefined") return null

  const encoded = encodeGraphToUrlParam(graph)
  const url = `${window.location.origin}${window.location.pathname}?${GRAPH_URL_PARAM}=${encoded}`

  try {
    void navigator.clipboard.writeText(url)
    return url
  } catch {
    // Fallback: create a temporary input element
    try {
      const input = document.createElement("input")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      return url
    } catch {
      return null
    }
  }
}

/**
 * Check if the current URL has a graph parameter and return the decoded graph.
 * Returns null if no valid graph param is found.
 */
export function loadGraphFromUrlParam(): { graph: ContractGraph; encoded: string } | null {
  if (typeof window === "undefined") return null

  const params = new URLSearchParams(window.location.search)
  const encoded = params.get(GRAPH_URL_PARAM)
  if (!encoded) return null

  const graph = decodeGraphFromUrlParam(encoded)
  return graph ? { graph, encoded } : null
}

/**
 * Return the share URL string for a given graph without copying to clipboard.
 */
export function buildShareUrl(graph: ContractGraph): string {
  if (typeof window === "undefined") return ""
  const encoded = encodeGraphToUrlParam(graph)
  return `${window.location.origin}${window.location.pathname}?${GRAPH_URL_PARAM}=${encoded}`
}