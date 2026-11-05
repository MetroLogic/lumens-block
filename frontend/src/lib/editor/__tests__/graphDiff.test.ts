import { describe, expect, it, vi, beforeEach } from "vitest"

import { diffGraphs } from "../graphDiff"
import type { ContractGraph as SchemaContractGraph, ContractGraphNode, BlockType } from "@/lib/compile/schema"
import { getFunctionParamsFromGraph } from "@/lib/compile/codegen"

// The only way a param's Rust type can change is through the param derivation
// logic, which is deterministic given a block-type set. To exercise the
// param_type_changed rule we spy on getFunctionParamsFromGraph and fall back
// to the real implementation for every other test.
vi.mock("@/lib/compile/codegen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/compile/codegen")>()
  return {
    ...actual,
    getFunctionParamsFromGraph: vi.fn((graph: SchemaContractGraph) =>
      actual.getFunctionParamsFromGraph(graph)
    ),
  }
})

function node(id: string, type: BlockType, label: string, params?: Record<string, unknown>): ContractGraphNode {
  return {
    id,
    type,
    data: {
      label,
      ...(params ? { params } : {}),
    },
  }
}

function makeGraph(
  nodes: ContractGraphNode[],
  connections: [string, string][]
): SchemaContractGraph {
  return {
    nodes,
    edges: connections.map(([source, target], index) => ({
      id: `e${index}`,
      source,
      target,
    })),
  }
}

const start = () => node("1", "default", "Start")

describe("diffGraphs", () => {
  beforeEach(() => {
    vi.mocked(getFunctionParamsFromGraph).mockClear()
  })

  it("returns an empty diff when nothing has been deployed yet (first deploy)", () => {
    const next = makeGraph([start(), node("2", "Auth", "Auth Check")], [["1", "2"]])

    const diff = diffGraphs(null, next)

    expect(diff.hasBreakingChanges).toBe(false)
    expect(diff.addedNodes).toEqual([])
    expect(diff.removedNodes).toEqual([])
    expect(diff.modifiedNodes).toEqual([])
    expect(diff.addedEdges).toEqual([])
    expect(diff.removedEdges).toEqual([])
    expect(diff.breakingChanges).toEqual([])
  })

  it("flags node_removed when an executable block disappears", () => {
    const prev = makeGraph(
      [start(), node("2", "Auth", "Auth Check"), node("3", "Transfer", "Transfer Tokens")],
      [
        ["1", "2"],
        ["2", "3"],
      ]
    )
    const next = makeGraph([start(), node("2", "Auth", "Auth Check")], [["1", "2"]])

    const diff = diffGraphs(prev, next)

    expect(diff.removedNodes.map((n) => n.id)).toEqual(["3"])
    expect(diff.hasBreakingChanges).toBe(true)
    expect(diff.breakingChanges.some((c) => c.kind === "node_removed" && c.nodeId === "3")).toBe(true)
  })

  it("flags storage_key_renamed when a Storage block's key changes", () => {
    const prev = makeGraph(
      [start(), node("2", "Storage", "Save Value", { storageKey: "balance" })],
      [["1", "2"]]
    )
    const next = makeGraph(
      [start(), node("2", "Storage", "Save Value", { storageKey: "escrow" })],
      [["1", "2"]]
    )

    const diff = diffGraphs(prev, next)

    expect(diff.hasBreakingChanges).toBe(true)
    const rename = diff.breakingChanges.find((c) => c.kind === "storage_key_renamed")
    expect(rename?.nodeId).toBe("2")
    expect(rename?.description).toMatch(/Storage key "balance" was renamed to "escrow"/)

    // The key change is also reported as a field-level modification
    expect(diff.modifiedNodes[0].changedFields).toContain("params.storageKey")
  })

  it("flags param_removed when a block that contributes params is removed", () => {
    const prev = makeGraph(
      [start(), node("2", "Transfer", "Transfer Tokens")],
      [["1", "2"]]
    )
    const next = makeGraph(
      [start(), node("2", "Storage", "Save Value", { storageKey: "balance" })],
      [["1", "2"]]
    )

    const diff = diffGraphs(prev, next)

    const removedParams = diff.breakingChanges.filter((c) => c.kind === "param_removed")
    expect(removedParams.length).toBeGreaterThan(0)
    expect(removedParams.some((c) => c.description.includes('"amount"'))).toBe(true)
  })

  it("flags param_type_changed when a param's Rust type changes", () => {
    const prev = makeGraph([start(), node("2", "Auth", "Auth Check")], [["1", "2"]])
    const next = makeGraph([start(), node("2", "Auth", "Auth Check")], [["1", "2"]])

    vi.mocked(getFunctionParamsFromGraph)
      .mockReturnValueOnce([
        { name: "env", rustType: "Env" },
        { name: "caller", rustType: "Address" },
        { name: "amount", rustType: "i128" },
      ])
      .mockReturnValueOnce([
        { name: "env", rustType: "Env" },
        { name: "caller", rustType: "Address" },
        { name: "amount", rustType: "bool" },
      ])

    const diff = diffGraphs(prev, next)

    const typeChange = diff.breakingChanges.find((c) => c.kind === "param_type_changed")
    expect(typeChange).toBeDefined()
    expect(typeChange?.description).toMatch(/changed type from i128 to bool/)
  })

  it("flags execution_order_changed when Auth/Transfer blocks are reordered", () => {
    const prev = makeGraph(
      [start(), node("2", "Auth", "Auth Check"), node("3", "Transfer", "Transfer Tokens")],
      [
        ["1", "2"],
        ["2", "3"],
      ]
    )
    const next = makeGraph(
      [start(), node("2", "Auth", "Auth Check"), node("3", "Transfer", "Transfer Tokens")],
      [
        ["1", "3"],
        ["3", "2"],
      ]
    )

    const diff = diffGraphs(prev, next)

    const orderChange = diff.breakingChanges.find((c) => c.kind === "execution_order_changed")
    expect(orderChange).toBeDefined()
    expect(orderChange?.description).toMatch(/Execution order of Auth\/Transfer blocks changed/)
  })

  it("does not report execution order changes from simply adding a block", () => {
    const prev = makeGraph(
      [start(), node("2", "Auth", "Auth Check"), node("3", "Transfer", "Transfer Tokens")],
      [
        ["1", "2"],
        ["2", "3"],
      ]
    )
    const next = makeGraph(
      [
        start(),
        node("2", "Auth", "Auth Check"),
        node("3", "Transfer", "Transfer Tokens"),
        node("4", "Transfer", "Second Transfer"),
      ],
      [
        ["1", "2"],
        ["2", "3"],
        ["3", "4"],
      ]
    )

    const diff = diffGraphs(prev, next)

    expect(diff.addedNodes.map((n) => n.id)).toEqual(["4"])
    expect(diff.breakingChanges.some((c) => c.kind === "execution_order_changed")).toBe(false)
    expect(diff.hasBreakingChanges).toBe(false)
  })

  it("reports added nodes/edges and removed edges as non-breaking", () => {
    const prev = makeGraph(
      [start(), node("2", "Storage", "Save Value"), node("3", "Event", "Emit Event")],
      [
        ["1", "2"],
        ["2", "3"],
      ]
    )
    const next = makeGraph(
      [
        start(),
        node("2", "Storage", "Save Value"),
        node("3", "Event", "Emit Event"),
        node("4", "Condition", "Check Release"),
      ],
      [
        ["1", "2"],
        ["1", "3"],
        ["2", "4"],
      ]
    )

    const diff = diffGraphs(prev, next)

    expect(diff.addedNodes.map((n) => n.id)).toEqual(["4"])
    expect(diff.addedEdges.map((e) => `${e.source}->${e.target}`)).toContain("2->4")
    expect(diff.removedEdges.map((e) => `${e.source}->${e.target}`)).toContain("2->3")
    expect(diff.hasBreakingChanges).toBe(false)
  })

  it("reports field-level modifications with dotted paths", () => {
    const prev = makeGraph(
      [start(), node("2", "Storage", "Save Value", { storageKey: "balance" })],
      [["1", "2"]]
    )
    const next = makeGraph(
      [start(), node("2", "Storage", "Renamed Block", { storageKey: "balance" })],
      [["1", "2"]]
    )

    const diff = diffGraphs(prev, next)

    expect(diff.modifiedNodes).toHaveLength(1)
    expect(diff.modifiedNodes[0].changedFields).toContain("data.label")
    expect(diff.hasBreakingChanges).toBe(false)
  })
})
