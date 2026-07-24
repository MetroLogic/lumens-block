import { describe, expect, it, vi } from "vitest"
import { compileGraph, topologicalSort } from "../index"
import type { ContractGraph } from "../index"

describe("compileGraph", () => {
  it("maps Start node to the contract entry-point function signature", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Require Auth" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("pub fn execute(env: Env")
    expect(code).toContain("caller.require_auth();")
  })

  it("produces valid Soroban output for Transfer block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "transfer", type: "Transfer", data: { label: "Transfer XLM" } },
      ],
      edges: [{ id: "e1", source: "start", target: "transfer" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("token::Client::new(&env, &token).transfer(&from, &to, &amount);")
  })

  it("produces valid Soroban output for Condition block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "cond", type: "Condition", data: { label: "Check Release" } },
      ],
      edges: [{ id: "e1", source: "start", target: "cond" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("if !release {")
    expect(code).toContain("panic_with_error!(&env, symbol_short!(\"cond\"));")
  })

  it("produces valid Soroban output for Storage block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "storage",
          type: "Storage",
          data: { label: "Save Value", params: { storageKey: "balance" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "storage" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("env.storage().instance().set(&symbol_short!(\"balance\"), &value);")
  })

  it("produces valid Soroban output for Event block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        {
          id: "event",
          type: "Event",
          data: { label: "Emit Event", params: { eventName: "transferred" } },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "event" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("env.events().publish((event_name,), (from.clone(), to.clone(), amount));")
  })

  it("produces valid Soroban output for Auth block type", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Require Auth" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const code = compileGraph(graph)
    expect(code).toContain("caller.require_auth();")
  })

  it("performs topological sort and visits nodes in execution order", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        { id: "transfer", type: "Transfer", data: { label: "Transfer" } },
        { id: "event", type: "Event", data: { label: "Event" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "auth" },
        { id: "e2", source: "auth", target: "transfer" },
        { id: "e3", source: "transfer", target: "event" },
      ],
    }

    const orderedNodes = topologicalSort(graph)
    expect(orderedNodes.map((n) => n.id)).toEqual(["auth", "transfer", "event"])
  })

  it("detects cyclic graphs and throws an error with a clear message", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "n1", type: "Transfer", data: { label: "Node 1" } },
        { id: "n2", type: "Condition", data: { label: "Node 2" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "n1" },
        { id: "e2", source: "n1", target: "n2" },
        { id: "e3", source: "n2", target: "n1" }, // Cycle: n1 -> n2 -> n1
      ],
    }

    expect(() => compileGraph(graph)).toThrow("Cyclic graph detected: graph contains a cycle.")
  })

  it("triggers a warning for disconnected nodes without throwing an error", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "start", type: "default", data: { label: "Start" } },
        { id: "auth", type: "Auth", data: { label: "Auth" } },
        { id: "floating", type: "Storage", data: { label: "Disconnected Node" } },
      ],
      edges: [{ id: "e1", source: "start", target: "auth" }],
    }

    const warnings: string[] = []
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const code = compileGraph(graph, {
      onWarning: (msg) => warnings.push(msg),
    })

    expect(code).toContain("caller.require_auth();")
    expect(code).not.toContain("Disconnected Node")
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain("Disconnected node \"floating\"")
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
