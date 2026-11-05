import { describe, expect, it } from "vitest"
import type { Node } from "reactflow"
import { checkConnection, CONNECTION_RULES, getRule, type BlockType } from "../connectionRules"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: type },
  }
}

const ALL_NODES: Node[] = [
  makeNode("start", "default"),
  makeNode("cond", "Condition"),
  makeNode("tx", "Transfer"),
  makeNode("store", "Storage"),
  makeNode("event", "Event"),
  makeNode("auth", "Auth"),
]

const ALL_IDS = ALL_NODES.map((n) => n.id)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRule", () => {
  it("returns a rule for each block type", () => {
    for (const t of CONNECTION_RULES) {
      expect(getRule(t.sourceType)).not.toBeNull()
    }
  })

  it("returns null for unknown types", () => {
    expect(getRule("Foo")).toBeNull()
    expect(getRule("")).toBeNull()
  })
})

describe("checkConnection — unknown nodes", () => {
  it("rejects when source node does not exist", () => {
    const result = checkConnection("ghost", "start", ALL_NODES, [])
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/unknown source/i)
  })

  it("rejects when target node does not exist", () => {
    const result = checkConnection("start", "ghost", ALL_NODES, [])
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/unknown target/i)
  })
})

describe("checkConnection — self-connections", () => {
  it("rejects any node connecting to itself", () => {
    for (const id of ALL_IDS) {
      const result = checkConnection(id, id, ALL_NODES, [])
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/cannot connect to itself/i)
    }
  })
})

describe("checkConnection — Start (default)", () => {
  const source = "start"

  it("allows Start → any executable block", () => {
    for (const target of ["cond", "tx", "store", "event", "auth"]) {
      const result = checkConnection(source, target, ALL_NODES, [])
      expect(result.valid).toBe(true)
    }
  })

  it("limits Start to 1 outgoing edge", () => {
    const existingEdges = [{ source, target: "cond" }]
    const result = checkConnection(source, "tx", ALL_NODES, existingEdges)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 1/)
  })
})

describe("checkConnection — Condition", () => {
  const source = "cond"

  it("allows Condition → any executable block", () => {
    const targets: Record<string, string> = {
      tx: "tx",
      store: "store",
      event: "event",
      auth: "auth",
    }
    for (const target of Object.values(targets)) {
      const result = checkConnection(source, target, ALL_NODES, [])
      expect(result.valid).toBe(true)
    }
  })

  it("allows Condition → another Condition (distinct node)", () => {
    const cond2 = makeNode("cond2", "Condition")
    const nodes = [...ALL_NODES, cond2]
    const result = checkConnection(source, "cond2", nodes, [])
    expect(result.valid).toBe(true)
  })

  it("allows up to 2 outgoing edges from Condition", () => {
    const existingEdges = [
      { source, target: "tx" },
      { source, target: "store" },
    ]
    const result = checkConnection(source, "event", ALL_NODES, existingEdges)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 2/)
  })

  it("allows exactly 2 outgoing edges", () => {
    const existingEdges = [{ source, target: "tx" }]
    const result = checkConnection(source, "store", ALL_NODES, existingEdges)
    expect(result.valid).toBe(true)
  })
})

describe("checkConnection — Transfer", () => {
  const source = "tx"

  it("allows Transfer → any executable block except Start", () => {
    const result1 = checkConnection(source, "cond", ALL_NODES, [])
    expect(result1.valid).toBe(true)

    const result2 = checkConnection(source, "store", ALL_NODES, [])
    expect(result2.valid).toBe(true)
  })

  it("limits Transfer to 1 outgoing edge", () => {
    const existingEdges = [{ source, target: "cond" }]
    const result = checkConnection(source, "store", ALL_NODES, existingEdges)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 1/)
  })
})

describe("checkConnection — Storage", () => {
  const source = "store"

  it("allows Storage → any executable block", () => {
    const result = checkConnection(source, "cond", ALL_NODES, [])
    expect(result.valid).toBe(true)
  })

  it("limits Storage to 1 outgoing edge", () => {
    const existingEdges = [{ source, target: "cond" }]
    const result = checkConnection(source, "tx", ALL_NODES, existingEdges)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 1/)
  })
})

describe("checkConnection — Event (terminal)", () => {
  const source = "event"

  it("rejects Event → any block (0 outgoing edges)", () => {
    const result = checkConnection(source, "cond", ALL_NODES, [])
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 0|no outgoing/i)
  })

  it("rejects even with 0 existing edges", () => {
    const result = checkConnection(source, "tx", ALL_NODES, [])
    expect(result.valid).toBe(false)
  })
})

describe("checkConnection — Auth", () => {
  const source = "auth"

  it("allows Auth → Transfer, Storage, Event", () => {
    expect(checkConnection(source, "tx", ALL_NODES, []).valid).toBe(true)
    expect(checkConnection(source, "store", ALL_NODES, []).valid).toBe(true)
    expect(checkConnection(source, "event", ALL_NODES, []).valid).toBe(true)
  })

  it("rejects Auth → Condition and Start", () => {
    const result1 = checkConnection(source, "cond", ALL_NODES, [])
    expect(result1.valid).toBe(false)
    expect(result1.reason).toMatch(/cannot connect/i)

    const result2 = checkConnection(source, "start", ALL_NODES, [])
    expect(result2.valid).toBe(false)
    expect(result2.reason).toMatch(/cannot connect/i)
  })

  it("limits Auth to 1 outgoing edge", () => {
    const existingEdges = [{ source, target: "tx" }]
    const result = checkConnection(source, "store", ALL_NODES, existingEdges)
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/at most 1/)
  })
})

describe("checkConnection — rules are symmetrical for all valid pairs", () => {
  it("validates all Source → Target pairs from the rule table", () => {
    for (const rule of CONNECTION_RULES) {
      for (const targetType of rule.validTargets) {
        const srcNode = makeNode("src", rule.sourceType)
        const tgtNode = makeNode("tgt", targetType)
        const nodes = [srcNode, tgtNode]
        const result = checkConnection("src", "tgt", nodes, [])
        expect(result.valid).toBe(true)
      }
    }
  })
})

describe("checkConnection — edge count edge cases", () => {
  it("rejects all connections when maxOutEdges is 0 regardless of existing edges", () => {
    const eventRule = CONNECTION_RULES.find((r) => r.sourceType === "Event")
    expect(eventRule?.maxOutEdges).toBe(0)

    for (const targetType of ["Condition", "Transfer", "Storage", "Auth", "default"] as BlockType[]) {
      const srcNode = makeNode("src", "Event")
      const tgtNode = makeNode("tgt", targetType)
      const result = checkConnection("src", "tgt", [srcNode, tgtNode], [])
      expect(result.valid).toBe(false)
    }
  })

  it("allows Condition to have exactly 2 edges", () => {
    const srcNode = makeNode("src", "Condition")
    const tgt1 = makeNode("tgt1", "Transfer")
    const tgt2 = makeNode("tgt2", "Storage")
    const nodes = [srcNode, tgt1, tgt2]
    const edges = [
      { source: "src", target: "tgt1" },
      { source: "src", target: "tgt2" },
    ]
    // Adding a third should fail
    const tgt3 = makeNode("tgt3", "Event")
    nodes.push(tgt3)
    const result = checkConnection("src", "tgt3", nodes, edges)
    expect(result.valid).toBe(false)
  })
})
