import { describe, expect, it } from "vitest"
import type { Edge, Node } from "reactflow"
import { validateGraph } from "./validateGraph"

const start: Node = { id: "start", type: "default", position: { x: 0, y: 0 }, data: { label: "Start" } }

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target }
}

describe("validateGraph", () => {
  it("flags unreachable nodes by id", () => {
    const isolated: Node = { id: "isolated", type: "Event", position: { x: 0, y: 0 }, data: { label: "Orphan event", params: { eventName: "done" } } }
    const result = validateGraph({ nodes: [start, isolated], edges: [] })

    expect(result.valid).toBe(false)
    expect(result.issuesByNodeId.isolated?.[0].code).toBe("UNREACHABLE_NODE")
  })

  it("requires Transfer amount configuration", () => {
    const transfer: Node = { id: "transfer", type: "Transfer", position: { x: 0, y: 0 }, data: { label: "Transfer", params: {} } }
    const result = validateGraph({ nodes: [start, transfer], edges: [edge("start", "transfer")] })

    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes('"amount"'))).toBe(true)
  })

  it("flags malformed Stellar G account fields", () => {
    const auth: Node = { id: "auth", type: "Auth", position: { x: 0, y: 0 }, data: { label: "Auth", params: { signerAddress: "GBAD" } } }
    const result = validateGraph({ nodes: [start, auth], edges: [edge("start", "auth")] })

    expect(result.valid).toBe(false)
    expect(result.issuesByNodeId.auth?.[0].code).toBe("INVALID_STELLAR_ADDRESS")
  })

  it("passes a valid linear graph", () => {
    const storage: Node = { id: "storage", type: "Storage", position: { x: 0, y: 0 }, data: { label: "Storage", params: { storageKey: "balance" } } }
    const result = validateGraph({ nodes: [start, storage], edges: [edge("start", "storage")] })

    expect(result.valid).toBe(true)
  })
})