import { describe, expect, it } from "vitest"

import { generateContractSource, getExecutionOrder } from "@/lib/compile/codegen"
import type { ContractGraph } from "@/lib/compile/schema"
import { validateContractGraph, validateGraphStructure } from "@/lib/compile/validate"
import { compileGraph } from "@/lib/compiler"
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

// ---------------------------------------------------------------------------
// Multi-function graphs (FunctionEntry / FunctionReturn)
// ---------------------------------------------------------------------------

function entryNode(
  id: string,
  functionName: string,
  extra: Record<string, unknown> = {}
): ContractGraph["nodes"][number] {
  return {
    id,
    type: "FunctionEntry",
    data: { label: functionName, params: { functionName, ...extra } },
  }
}

function returnNode(
  id: string,
  params: Record<string, unknown> = {}
): ContractGraph["nodes"][number] {
  return { id, type: "FunctionReturn", data: { label: "Return", params } }
}

/** deposit(env, amount: i128) -> i128 and withdraw(env, amount: i128) -> bool. */
function twoFunctionGraph(): ContractGraph {
  return {
    nodes: [
      entryNode("fe1", "deposit", { functionParams: [{ name: "amount", rustType: "i128" }] }),
      returnNode("fr1", { returnType: "i128", returnValue: "amount" }),
      entryNode("fe2", "withdraw", { functionParams: [{ name: "amount", rustType: "i128" }] }),
      returnNode("fr2", { returnType: "bool", returnValue: "true" }),
    ],
    edges: [
      { id: "e1", source: "fe1", target: "fr1" },
      { id: "e2", source: "fe2", target: "fr2" },
    ],
  }
}

describe("generateContractSource — multi-function graphs", () => {
  it("emits one named function for a single FunctionEntry, not execute()", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "get_balance"),
        returnNode("fr1", { returnType: "i128", returnValue: "0" }),
      ],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    const { source } = generateContractSource(graph)

    expect(source).toContain("pub fn get_balance(env: Env) -> i128")
    expect(source).not.toContain("pub fn execute")
  })

  it("emits two separate pub fn blocks inside the same impl", () => {
    const { source } = generateContractSource(twoFunctionGraph())

    expect(source).toContain("pub fn deposit(env: Env, amount: i128) -> i128")
    expect(source).toContain("pub fn withdraw(env: Env, amount: i128) -> bool")
    // Both live in one #[contractimpl] impl block.
    expect(source.match(/#\[contractimpl\]/g)).toHaveLength(1)
    expect(source.match(/impl LumensBlockGenerated \{/g)).toHaveLength(1)
    // Return expressions come from the FunctionReturn config.
    expect(source).toContain("amount\n    }")
    expect(source).toContain("true\n    }")
  })

  it("returns a validation error for duplicate function names", () => {
    const graph = twoFunctionGraph()
    graph.nodes[2] = entryNode("fe2", "deposit")

    expect(() => generateContractSource(graph)).toThrow(/deposit/)
    expect(validateGraphStructure(graph)?.code).toBe("DUPLICATE_FUNCTION_NAME")
  })

  it("returns a validation error for a FunctionEntry with no FunctionReturn", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "deposit"),
        { id: "a1", type: "Auth", data: { label: "Auth" } },
      ],
      edges: [{ id: "e1", source: "fe1", target: "a1" }],
    }

    expect(validateGraphStructure(graph)?.code).toBe("MISSING_FUNCTION_RETURN")
    expect(() => generateContractSource(graph)).toThrow(/FunctionReturn/)
  })

  it("falls back to a single execute() when no FunctionEntry is present", () => {
    const { source } = generateContractSource(transferGraph)

    expect(source).toContain("pub fn execute")
    expect(source).not.toContain("FunctionEntry")
  })

  it("rejects function names that are not valid Rust identifiers", () => {
    const graph: ContractGraph = {
      nodes: [entryNode("fe1", "Deposit Funds"), returnNode("fr1")],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    expect(validateGraphStructure(graph)?.code).toBe("INVALID_FUNCTION_NAME")
  })

  it("rejects parameter types containing statement characters", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "deposit", {
          functionParams: [{ name: "amount", rustType: "i128) { panic!();" }],
        }),
        returnNode("fr1"),
      ],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    expect(validateGraphStructure(graph)?.code).toBe("INVALID_PARAM_TYPE")
  })

  it("rejects more than ten declared parameters", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "wide", {
          functionParams: Array.from({ length: 11 }, (_, i) => ({
            name: `p${i}`,
            rustType: "i128",
          })),
        }),
        returnNode("fr1"),
      ],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    expect(validateGraphStructure(graph)?.code).toBe("TOO_MANY_FUNCTION_PARAMS")
  })

  it("rejects a block shared between two function subgraphs", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "deposit"),
        entryNode("fe2", "withdraw"),
        { id: "a1", type: "Auth", data: { label: "Shared Auth" } },
        returnNode("fr1"),
      ],
      edges: [
        { id: "e1", source: "fe1", target: "a1" },
        { id: "e2", source: "fe2", target: "a1" },
        { id: "e3", source: "a1", target: "fr1" },
      ],
    }

    const error = validateGraphStructure(graph)
    expect(["SHARED_FUNCTION_BLOCK", "SHARED_FUNCTION_RETURN"]).toContain(error?.code)
  })

  it("rejects a FunctionReturn unreachable from any FunctionEntry", () => {
    const graph = twoFunctionGraph()
    graph.nodes.push(returnNode("fr3", { returnType: "()" }))

    expect(validateGraphStructure(graph)?.code).toBe("ORPHAN_FUNCTION_RETURN")
  })

  it("scopes each function body to its own subgraph", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "deposit"),
        { id: "a1", type: "Auth", data: { label: "Require caller" } },
        returnNode("fr1", { returnType: "()" }),
        entryNode("fe2", "read_only"),
        returnNode("fr2", { returnType: "u32", returnValue: "1" }),
      ],
      edges: [
        { id: "e1", source: "fe1", target: "a1" },
        { id: "e2", source: "a1", target: "fr1" },
        { id: "e3", source: "fe2", target: "fr2" },
      ],
    }

    const { source } = generateContractSource(graph)
    const deposit = source.slice(source.indexOf("pub fn deposit"), source.indexOf("pub fn read_only"))
    const readOnly = source.slice(source.indexOf("pub fn read_only"))

    // The Auth block belongs to deposit only, and drags `caller` into its
    // signature without touching the other function.
    expect(deposit).toContain("caller.require_auth()")
    expect(deposit).toContain("caller: Address")
    expect(readOnly).not.toContain("caller.require_auth()")
    expect(readOnly).toContain("pub fn read_only(env: Env) -> u32")
  })

  it("honours the configured visibility", () => {
    const graph: ContractGraph = {
      nodes: [
        entryNode("fe1", "internal_helper", { visibility: "pub(crate)" }),
        returnNode("fr1", { returnType: "()" }),
      ],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    expect(generateContractSource(graph).source).toContain("pub(crate) fn internal_helper")
  })

  it("emits a zero value when a return type has no configured expression", () => {
    const graph: ContractGraph = {
      nodes: [entryNode("fe1", "flag"), returnNode("fr1", { returnType: "bool" })],
      edges: [{ id: "e1", source: "fe1", target: "fr1" }],
    }

    const { source } = generateContractSource(graph)
    expect(source).toContain("pub fn flag(env: Env) -> bool")
    expect(source).toContain("false")
  })
})

describe("compileGraph — multi-function preview parity", () => {
  it("previews both functions from the same graph the compiler sees", () => {
    const preview = compileGraph(twoFunctionGraph())

    expect(preview).toContain("pub fn deposit")
    expect(preview).toContain("pub fn withdraw")
    expect(preview.match(/#\[contractimpl\]/g)).toHaveLength(1)
  })

  it("still emits execute() for graphs without FunctionEntry blocks", () => {
    expect(compileGraph(transferGraph)).toContain("pub fn execute")
  })

  it("surfaces the same validation errors as the compile path", () => {
    const graph = twoFunctionGraph()
    graph.nodes[2] = entryNode("fe2", "deposit")

    expect(() => compileGraph(graph)).toThrow(/deposit/)
  })
})
