import { describe, expect, it } from "vitest"

import { generateContractSource, getExecutionOrder } from "@/lib/compile/codegen"
import type { ContractGraph } from "@/lib/compile/schema"
import { validateContractGraph, validateGraphStructure } from "@/lib/compile/validate"
import tokenTransfer from "@/lib/templates/token-transfer.json"

const transferGraph = tokenTransfer as ContractGraph

describe("validateContractGraph", () => {
  it("accepts a valid graph with a Transfer block", () => {
    const result = validateContractGraph(transferGraph)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes).toHaveLength(4)
    }
  })

  it("preserves Transfer asset selector params during graph validation", () => {
    const result = validateContractGraph({
      nodes: [
        { id: "1", type: "default", data: { label: "Start" } },
        {
          id: "2",
          type: "Transfer",
          data: {
            label: "Pay USDC",
            params: {
              assetType: "sac",
              token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
              assetSymbol: "USDC",
              assetName: "USD Coin",
            },
          },
        },
      ],
      edges: [{ id: "e1", source: "1", target: "2" }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes[1].data.params).toEqual({
        assetType: "sac",
        token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        assetSymbol: "USDC",
        assetName: "USD Coin",
      })
    }
  })

  it("rejects malformed JSON payloads", () => {
    const result = validateContractGraph("not-an-object")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PAYLOAD")
    }
  })

  it("rejects graphs without a Start node", () => {
    const result = validateContractGraph({
      nodes: [{ id: "1", type: "Transfer", data: { label: "Transfer" } }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_START_NODE")
    }
  })

  it("rejects unknown block types", () => {
    const result = validateContractGraph({
      nodes: [
        { id: "1", type: "default", data: { label: "Start" } },
        { id: "2", type: "UnknownBlock", data: { label: "Bad" } },
      ],
      edges: [{ id: "e1", source: "1", target: "2" }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_BLOCK_TYPE")
    }
  })

  it("rejects oversized payloads", () => {
    const result = validateContractGraph(transferGraph, 512 * 1024)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("PAYLOAD_TOO_LARGE")
    }
  })

  it("rejects edges referencing missing nodes", () => {
    const result = validateContractGraph({
      nodes: [{ id: "1", type: "default", data: { label: "Start" } }],
      edges: [{ id: "e1", source: "1", target: "missing" }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_EDGE")
    }
  })
})

describe("validateGraphStructure", () => {
  it("requires executable blocks reachable from Start", () => {
    const error = validateGraphStructure({
      nodes: [{ id: "1", type: "default", data: { label: "Start" } }],
      edges: [],
    })
    expect(error?.code).toBe("NO_EXECUTABLE_BLOCKS")
  })
})

describe("generateContractSource", () => {
  it("generates Rust with Transfer logic for token-transfer template", () => {
    const { source, blockOrder } = generateContractSource(transferGraph)

    expect(blockOrder).toContain("Transfer:3")
    expect(source).toContain("pub fn execute")
    expect(source).toContain("token::Client::new(&env, &token).transfer(&from, &to, &amount)")
    expect(source).toContain("caller.require_auth()")
    expect(source).toContain("env.events().publish")
  })

  it("orders blocks breadth-first from Start", () => {
    const order = getExecutionOrder(transferGraph).map((n) => n.type)
    expect(order).toEqual(["Auth", "Transfer", "Event"])
  })

  it("includes Condition guard when present", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "1", type: "default", data: { label: "Start" } },
        { id: "2", type: "Condition", data: { label: "Check release" } },
        { id: "3", type: "Transfer", data: { label: "Pay out" } },
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    const { source } = generateContractSource(graph)
    expect(source).toContain("if !release")
    expect(source).toContain("token::Client::new(&env, &token).transfer")
  })
})
