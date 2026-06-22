import { describe, expect, it } from "vitest"
import type { Edge, Node } from "reactflow"

import { deleteSelectedNodes, getSelectedNodeIds } from "./selection"

const nodes: Node[] = [
  { id: "start", position: { x: 0, y: 0 }, data: { label: "Start" }, selected: false },
  { id: "transfer", position: { x: 120, y: 0 }, data: { label: "Transfer" }, selected: true },
  { id: "event", position: { x: 240, y: 0 }, data: { label: "Event" }, selected: true },
  { id: "storage", position: { x: 360, y: 0 }, data: { label: "Storage" }, selected: false },
]

const edges: Edge[] = [
  { id: "start-transfer", source: "start", target: "transfer" },
  { id: "transfer-event", source: "transfer", target: "event" },
  { id: "event-storage", source: "event", target: "storage" },
  { id: "start-storage", source: "start", target: "storage" },
]

describe("selection helpers", () => {
  it("returns selected node ids in canvas order", () => {
    expect(getSelectedNodeIds(nodes)).toEqual(["transfer", "event"])
  })

  it("removes selected nodes and all connected edges", () => {
    const result = deleteSelectedNodes(nodes, edges)

    expect(result.deletedNodeIds).toEqual(["transfer", "event"])
    expect(result.deletedEdgeIds).toEqual(["start-transfer", "transfer-event", "event-storage"])
    expect(result.nodes.map((node) => node.id)).toEqual(["start", "storage"])
    expect(result.edges.map((edge) => edge.id)).toEqual(["start-storage"])
  })

  it("keeps array identity when no nodes are selected", () => {
    const unselectedNodes = nodes.map((node) => ({ ...node, selected: false }))
    const result = deleteSelectedNodes(unselectedNodes, edges)

    expect(result.deletedNodeIds).toEqual([])
    expect(result.nodes).toBe(unselectedNodes)
    expect(result.edges).toBe(edges)
  })
})
