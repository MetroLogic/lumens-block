import { describe, expect, it } from "vitest"

import type { ContractGraph } from "@/lib/compile/schema"
import { validateContractGraph, validateStoredContractGraph } from "@/lib/compile/validate"
import {
  GRAPH_STORAGE_KEY,
  graphToJson,
  graphToReactFlow,
  readStoredGraph,
  validateGraphJsonText,
  writeStoredGraph,
} from "@/lib/editor/graphStorage"
import type { Edge, Node } from "reactflow"

const draftGraph: ContractGraph = {
  nodes: [
    { id: "1", type: "default", position: { x: 250, y: 150 }, data: { label: "Start" } },
  ],
  edges: [],
}

const savedGraph: ContractGraph = {
  nodes: [
    { id: "1", type: "default", position: { x: 250, y: 150 }, data: { label: "Start" } },
    { id: "2", type: "Transfer", position: { x: 500, y: 150 }, data: { label: "Pay" } },
  ],
  edges: [{ id: "e1", source: "1", target: "2", sourceHandle: null, targetHandle: null }],
}

const editorNodes: Node[] = savedGraph.nodes.map((node) => ({
  id: node.id,
  type: node.type,
  position: node.position!,
  data: node.data,
}))

const editorEdges: Edge[] = savedGraph.edges.map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle ?? null,
  targetHandle: edge.targetHandle ?? null,
}))

describe("graph storage helpers", () => {
  it("round-trips editor graphs through JSON and React Flow shapes", () => {
    const json = graphToJson(editorNodes, editorEdges)
    const validated = validateGraphJsonText(json)

    expect(validated.ok).toBe(true)
    if (validated.ok) {
      expect(validated.graph).toEqual(savedGraph)
      expect(graphToReactFlow(validated.graph).nodes[1].position).toEqual({ x: 500, y: 150 })
    }
  })

  it("allows storing a draft graph with only Start", () => {
    const validated = validateStoredContractGraph(draftGraph)

    expect(validated.ok).toBe(true)
    expect(validateContractGraph(draftGraph).ok).toBe(false)
  })

  it("rejects malformed graph JSON", () => {
    const validated = validateGraphJsonText("{not json")

    expect(validated.ok).toBe(false)
    if (!validated.ok) {
      expect(validated.error.code).toBe("MALFORMED_JSON")
    }
  })

  it("rejects duplicate edge ids in stored graphs", () => {
    const validated = validateGraphJsonText(
      JSON.stringify({
        nodes: savedGraph.nodes,
        edges: [savedGraph.edges[0], savedGraph.edges[0]],
      })
    )

    expect(validated.ok).toBe(false)
    if (!validated.ok) {
      expect(validated.error.code).toBe("DUPLICATE_EDGE_ID")
    }
  })

  it("stores and reads graph state from browser storage", () => {
    const storage = new Map<string, string>()
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    } as Storage

    writeStoredGraph(fakeStorage, editorNodes, editorEdges)
    const raw = storage.get(GRAPH_STORAGE_KEY)

    expect(raw).toContain('"nodes"')

    const loaded = readStoredGraph(fakeStorage)
    expect(loaded?.ok).toBe(true)
    if (loaded?.ok) {
      expect(loaded.graph).toEqual(savedGraph)
    }
  })
})
