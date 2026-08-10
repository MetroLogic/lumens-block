import { describe, expect, it } from "vitest"

import {
  parseImportedGraphJson,
  toContractGraph,
  toReactFlowGraph,
} from "@/lib/editor/graphPersistence"
import { validateContractGraph } from "@/lib/compile/validate"
import tokenTransfer from "@/lib/templates/token-transfer.json"
import type { ContractGraph } from "@/lib/compile/schema"

const transferGraph = tokenTransfer as ContractGraph

describe("parseImportedGraphJson", () => {
  it("accepts a valid exported graph", () => {
    const result = parseImportedGraphJson(JSON.stringify(transferGraph))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes).toHaveLength(4)
      expect(result.graph.nodes[0].position).toEqual({ x: 250, y: 50 })
    }
  })

  it("rejects malformed JSON", () => {
    const result = parseImportedGraphJson("{not-json")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid json/i)
    }
  })

  it("rejects schema-invalid graphs without corrupting caller state", () => {
    const result = parseImportedGraphJson(
      JSON.stringify({
        nodes: [{ id: "1", type: "NotABlock", data: { label: "Bad" } }],
        edges: [],
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it("allows in-progress graphs with only a Start node", () => {
    const result = parseImportedGraphJson(
      JSON.stringify({
        nodes: [{ id: "1", type: "default", position: { x: 10, y: 20 }, data: { label: "Start" } }],
        edges: [],
      })
    )
    expect(result.ok).toBe(true)
  })
})

describe("toContractGraph / toReactFlowGraph round-trip", () => {
  it("preserves nodes, edges, and positions", () => {
    const { nodes, edges } = toReactFlowGraph(transferGraph)
    const exported = toContractGraph(nodes, edges)

    expect(exported.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }))).toEqual(
      transferGraph.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }))
    )
    expect(exported.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))).toEqual(
      transferGraph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    )
  })

  it("preserves edge labels through round-trip", () => {
    const graphWithLabels: ContractGraph = {
      ...transferGraph,
      edges: [
        { id: "e1", source: "1", target: "2", sourceHandle: "true", data: { label: "true" } },
        { id: "e2", source: "2", target: "3", sourceHandle: "success", data: { label: "success" } },
        { id: "e3", source: "3", target: "4", data: {} },
      ],
    }
    const { nodes, edges } = toReactFlowGraph(graphWithLabels)
    const exported = toContractGraph(nodes, edges)

    expect(exported.edges[0].data?.label).toBe("true")
    expect(exported.edges[1].data?.label).toBe("success")
    // Edge without label should not have data
    expect(exported.edges[2].data).toBeUndefined()
  })

  it("rejects invalid edge data in validateContractGraph", () => {
    const result = validateContractGraph(
      {
        ...transferGraph,
        edges: [
          { id: "e1", source: "1", target: "2", sourceHandle: "true", data: { label: "valid" } },
          { id: "e2", source: "2", target: "3", data: { label: 42 } },
        ],
      },
      undefined,
      { skipStructureValidation: true }
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      // label=42 (number) should be dropped — only string labels are valid
      expect(result.graph.edges[0].data?.label).toBe("valid")
      expect(result.graph.edges[1].data).toBeUndefined()
    }
  })
})

describe("validateContractGraph position + skipStructureValidation", () => {
  it("preserves node positions", () => {
    const result = validateContractGraph(transferGraph)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes[0].position).toEqual({ x: 250, y: 50 })
    }
  })

  it("accepts Start-only graphs when structure validation is skipped", () => {
    const result = validateContractGraph(
      {
        nodes: [{ id: "1", type: "default", data: { label: "Start" } }],
        edges: [],
      },
      undefined,
      { skipStructureValidation: true }
    )
    expect(result.ok).toBe(true)
  })
})
