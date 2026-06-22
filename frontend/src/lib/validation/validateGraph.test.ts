import { describe, expect, it } from "vitest"
import type { Edge, Node } from "reactflow"

import { validateGraph } from "./validateGraph"

const start: Node = {
  id: "start",
  type: "default",
  position: { x: 0, y: 0 },
  data: { label: "Start" },
}

const validToken = `G${"A".repeat(55)}`

function transfer(overrides: Partial<Node> = {}): Node {
  return {
    id: "transfer",
    type: "Transfer",
    position: { x: 0, y: 100 },
    data: {
      label: "Send payment",
      params: {
        token: validToken,
        amount: "100",
      },
    },
    ...overrides,
  }
}

function graph(nodes: Node[], edges: Edge[] = [{ id: "e1", source: "start", target: "transfer" }]) {
  return { nodes, edges }
}

describe("validateGraph", () => {
  it("passes a valid reachable graph", () => {
    const result = validateGraph(graph([start, transfer()]))

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("flags isolated nodes by id", () => {
    const isolated = transfer({
      id: "isolated",
      data: { label: "Isolated transfer", params: { token: validToken, amount: "5" } },
    })

    const result = validateGraph(graph([start, isolated], []))

    expect(result.valid).toBe(false)
    expect(result.invalidNodeIds.has("isolated")).toBe(true)
    expect(result.issues.some((issue) => issue.code === "UNREACHABLE_NODE")).toBe(true)
  })

  it("rejects graphs without reachable executable blocks", () => {
    const result = validateGraph(graph([start], []))

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "NO_EXECUTABLE_BLOCKS",
      })
    )
  })

  it("fails transfer nodes with missing amount", () => {
    const result = validateGraph(
      graph([
        start,
        transfer({
          data: { label: "Send payment", params: { token: validToken } },
        }),
      ])
    )

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_REQUIRED_FIELD",
        nodeId: "transfer",
        field: "amount",
      })
    )
  })

  it("flags invalid Stellar addresses inline", () => {
    const result = validateGraph(
      graph([
        start,
        transfer({
          data: { label: "Send payment", params: { token: "not-a-stellar-address", amount: "1" } },
        }),
      ])
    )

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_STELLAR_ADDRESS",
        nodeId: "transfer",
        field: "token",
      })
    )
  })

  it("detects cycles", () => {
    const result = validateGraph(
      graph(
        [start, transfer()],
        [
          { id: "e1", source: "start", target: "transfer" },
          { id: "e2", source: "transfer", target: "transfer" },
        ]
      )
    )

    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === "CYCLE_DETECTED")).toBe(true)
  })
})
