import { describe, expect, it } from "vitest"
import type { Edge, Node } from "reactflow"

import {
  SHARE_GRAPH_NODE_LIMIT,
  SHARE_GRAPH_PARAM,
  buildShareUrl,
  decodeSharedGraph,
  encodeSharedGraph,
} from "./graphShare"

const nodes: Node[] = [
  { id: "1", type: "default", position: { x: 10, y: 20 }, data: { label: "Start" } },
  { id: "2", type: "Transfer", position: { x: 30, y: 40 }, data: { label: "Pay" } },
]

const edges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", sourceHandle: "success", targetHandle: null },
]

describe("graph sharing", () => {
  it("round-trips a React Flow graph through URL-safe base64", () => {
    const encoded = encodeSharedGraph({ nodes, edges })
    const decoded = decodeSharedGraph(encoded)

    expect(encoded).not.toMatch(/[+/=]/)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.graph.nodes).toEqual(nodes)
      expect(decoded.graph.edges).toEqual(edges)
    }
  })

  it("builds a share URL with the graph query parameter", () => {
    const url = buildShareUrl("https://example.test/editor?foo=bar", { nodes, edges })
    const parsed = new URL(url)

    expect(parsed.searchParams.get("foo")).toBe("bar")
    expect(parsed.searchParams.get(SHARE_GRAPH_PARAM)).toBeTruthy()
    expect(decodeSharedGraph(parsed.searchParams.get(SHARE_GRAPH_PARAM)).ok).toBe(true)
  })

  it("rejects malformed or oversized graph payloads", () => {
    expect(decodeSharedGraph("not-base64").ok).toBe(false)

    const oversizedNodes = Array.from({ length: SHARE_GRAPH_NODE_LIMIT + 1 }, (_, index) => ({
      id: `node-${index}`,
      type: "Transfer",
      position: { x: index, y: index },
      data: { label: `Node ${index}` },
    })) as Node[]

    expect(() => encodeSharedGraph({ nodes: oversizedNodes, edges: [] })).toThrow("up to 30 nodes")
  })
})
