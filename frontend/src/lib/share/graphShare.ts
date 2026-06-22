import type { Edge, Node } from "reactflow"

import { normalizeReactFlowGraph } from "@/lib/compile/validate"
import type { ContractGraph } from "@/lib/compile/schema"

export const SHARE_GRAPH_PARAM = "graph"
export const SHARE_GRAPH_NODE_LIMIT = 30

export interface SharedGraphPayload {
  nodes: Node[]
  edges: Edge[]
}

export type DecodeSharedGraphResult =
  | { ok: true; graph: SharedGraphPayload }
  | { ok: false; error: string }

function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromUrlSafeBase64(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4))
  return `${base64}${padding}`
}

function encodeUtf8(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64")
  }

  const bytes = new TextEncoder().encode(value)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function decodeUtf8(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64").toString("utf8")
  }

  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function createSharedGraphPayload(graph: SharedGraphPayload): ContractGraph {
  return normalizeReactFlowGraph(graph)
}

export function encodeSharedGraph(graph: SharedGraphPayload): string {
  const payload = createSharedGraphPayload(graph)

  if (payload.nodes.length > SHARE_GRAPH_NODE_LIMIT) {
    throw new Error(`Share links support up to ${SHARE_GRAPH_NODE_LIMIT} nodes.`)
  }

  return toUrlSafeBase64(encodeUtf8(JSON.stringify(payload)))
}

export function decodeSharedGraph(value: string | null | undefined): DecodeSharedGraphResult {
  if (!value) {
    return { ok: false, error: "Missing shared graph data." }
  }

  try {
    const json = decodeUtf8(fromUrlSafeBase64(value))
    const parsed = JSON.parse(json) as ContractGraph

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return { ok: false, error: "Shared graph data is not a graph." }
    }

    if (parsed.nodes.length > SHARE_GRAPH_NODE_LIMIT) {
      return { ok: false, error: `Shared graph exceeds ${SHARE_GRAPH_NODE_LIMIT} nodes.` }
    }

    return {
      ok: true,
      graph: {
        nodes: parsed.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position ?? { x: 0, y: 0 },
          data: node.data,
        })) as Node[],
        edges: parsed.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
        })) as Edge[],
      },
    }
  } catch {
    return { ok: false, error: "Shared graph data is malformed." }
  }
}

export function buildShareUrl(baseUrl: string, graph: SharedGraphPayload): string {
  const url = new URL(baseUrl)
  url.searchParams.set(SHARE_GRAPH_PARAM, encodeSharedGraph(graph))
  return url.toString()
}
