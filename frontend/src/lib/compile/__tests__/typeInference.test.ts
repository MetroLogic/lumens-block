import { describe, expect, it } from "vitest"

import { inferGraphTypes } from "@/lib/compile/typeInference"
import type { ConditionExpression, ContractGraph, ContractGraphNode } from "@/lib/compile/schema"

function node(partial: Partial<ContractGraphNode> & { id: string; type: ContractGraphNode["type"] }): ContractGraphNode {
  return { data: { label: partial.type }, ...partial }
}

describe("inferGraphTypes — declared port types per block", () => {
  it("types Auth's caller input as Address", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "Auth" })],
      edges: [],
    })
    expect(portTypes.get("1:caller")?.rustType).toBe("Address")
  })

  it("types Transfer's from/to/token as Address and amount as i128", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "Transfer" })],
      edges: [],
    })
    expect(portTypes.get("1:from")?.rustType).toBe("Address")
    expect(portTypes.get("1:to")?.rustType).toBe("Address")
    expect(portTypes.get("1:token")?.rustType).toBe("Address")
    expect(portTypes.get("1:amount")?.rustType).toBe("i128")
  })

  it("types Event's from/to as Address and amount as i128", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "Event" })],
      edges: [],
    })
    expect(portTypes.get("1:from")?.rustType).toBe("Address")
    expect(portTypes.get("1:amount")?.rustType).toBe("i128")
  })

  it("types a write-mode Storage node's declared input as its storageReturnType (default i128)", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "Storage" })],
      edges: [],
    })
    expect(portTypes.get("1:in")?.rustType).toBe("i128")
  })

  it("types a read-mode Storage node's output as its declared storageReturnType", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [
        node({
          id: "1",
          type: "Storage",
          data: { label: "Storage", params: { storageMode: "read", storageReturnType: "bool" } },
        }),
      ],
      edges: [],
    })
    expect(portTypes.get("1:out")?.rustType).toBe("bool")
  })

  it("types a configured Condition's true/false branches as bool", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [
        node({
          id: "1",
          type: "Condition",
          data: {
            label: "Cond",
            params: {
              conditionExpression: {
                left: { type: "invocationArg", value: "amount" },
                operator: "==",
                right: { type: "constant", value: "5", constantKind: "number" },
              },
            },
          },
        }),
      ],
      edges: [],
    })
    expect(portTypes.get("1:true")?.rustType).toBe("bool")
    expect(portTypes.get("1:false")?.rustType).toBe("bool")
  })

  it("does not type an unconfigured Condition's branches", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "Condition" })],
      edges: [],
    })
    expect(portTypes.has("1:true")).toBe(false)
    expect(portTypes.has("1:false")).toBe(false)
  })

  it("assigns default (Start) node no port types", () => {
    const { portTypes } = inferGraphTypes({
      nodes: [node({ id: "1", type: "default" })],
      edges: [],
    })
    expect(portTypes.size).toBe(0)
  })
})

describe("inferGraphTypes — Storage(read)/CrossContractCall → Storage(write) edge mismatches", () => {
  it("flags a Storage(read, bool) feeding a Storage(write, i128 default) edge", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({
          id: "2",
          type: "Storage",
          data: { label: "Read Flag", params: { storageMode: "read", storageKey: "flag", storageReturnType: "bool" } },
        }),
        node({ id: "3", type: "Storage", data: { label: "Write Amount", params: { storageKey: "amount" } } }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      edgeId: "e2",
      sourceNodeId: "2",
      targetNodeId: "3",
      sourceType: "bool",
      targetType: "i128",
    })
  })

  it("flags a CrossContractCall returnBinding feeding a Storage(write) of a different declared type", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({
          id: "2",
          type: "CrossContractCall",
          data: {
            label: "Call",
            params: {
              targetContractId: "C123",
              targetFunction: "owner",
              returnBinding: "owner_addr",
              returnType: "Address",
            },
          },
        }),
        node({
          id: "3",
          type: "Storage",
          data: { label: "Write", params: { storageKey: "k", storageReturnType: "Symbol" } },
        }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0].sourceType).toBe("Address")
    expect(errors[0].targetType).toBe("Symbol")
  })

  it("does not flag a Storage(read) → Storage(write) edge when the declared types agree", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({
          id: "2",
          type: "Storage",
          data: { label: "Read", params: { storageMode: "read", storageKey: "k", storageReturnType: "i128" } },
        }),
        node({ id: "3", type: "Storage", data: { label: "Write", params: { storageKey: "k2" } } }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("does not flag Transfer/Auth/Event feeding a Storage(write) node (no typed output in this codegen)", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({ id: "2", type: "Transfer" }),
        node({ id: "3", type: "Storage" }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })
})

describe("inferGraphTypes — Condition operand checks", () => {
  function conditionGraph(expr: ConditionExpression): ContractGraph {
    return {
      nodes: [
        node({ id: "1", type: "default" }),
        node({ id: "2", type: "Transfer" }),
        node({
          id: "3",
          type: "Condition",
          data: { label: "Guard", params: { conditionExpression: expr } },
        }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }
  }

  it("rejects a numeric operator applied to an Address invocationArg", () => {
    const graph = conditionGraph({
      left: { type: "invocationArg", value: "caller" },
      operator: ">",
      right: { type: "invocationArg", value: "amount" },
    })

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      edgeId: "e2",
      sourceNodeId: "2",
      targetNodeId: "3",
      sourceType: "Address",
      targetType: "i128",
    })
    expect(errors[0].message).toMatch(/non-numeric/)
  })

  it("rejects a numeric operator applied to a Symbol constant", () => {
    const graph = conditionGraph({
      left: { type: "constant", value: "owner", constantKind: "string" },
      operator: "<=",
      right: { type: "constant", value: "3", constantKind: "number" },
    })

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0].sourceType).toBe("Symbol")
  })

  it("accepts a numeric operator applied to two i128 operands", () => {
    const graph = conditionGraph({
      left: { type: "invocationArg", value: "amount" },
      operator: ">",
      right: { type: "constant", value: "100", constantKind: "number" },
    })

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("rejects a cross-type equality comparison (i128 vs Address)", () => {
    const graph = conditionGraph({
      left: { type: "invocationArg", value: "amount" },
      operator: "==",
      right: { type: "invocationArg", value: "token" },
    })

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/mismatched types/)
  })

  it("accepts an equality comparison between two Address operands", () => {
    const graph = conditionGraph({
      left: { type: "invocationArg", value: "caller" },
      operator: "==",
      right: { type: "invocationArg", value: "token" },
    })

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("resolves a storageKey operand as i128, matching what codegen actually emits", () => {
    const graph = conditionGraph({
      left: { type: "storageKey", value: "balance" },
      operator: ">",
      right: { type: "constant", value: "0", constantKind: "number" },
    })

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("skips operands that reference an unknown invocationArg name", () => {
    const graph = conditionGraph({
      left: { type: "invocationArg", value: "not_a_real_arg" },
      operator: ">",
      right: { type: "constant", value: "0", constantKind: "number" },
    })

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("skips Condition nodes without a conditionExpression", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({ id: "2", type: "Condition" }),
      ],
      edges: [{ id: "e1", source: "1", target: "2" }],
    }

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("falls back to a synthetic edgeId when the Condition node has no incoming edge", () => {
    const graph: ContractGraph = {
      nodes: [
        node({
          id: "1",
          type: "Condition",
          data: {
            label: "Guard",
            params: {
              conditionExpression: {
                left: { type: "constant", value: "owner", constantKind: "string" },
                operator: ">",
                right: { type: "constant", value: "1", constantKind: "number" },
              },
            },
          },
        }),
      ],
      edges: [],
    }

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0].edgeId).toBe("condition:1")
    expect(errors[0].sourceNodeId).toBe("1")
  })

  it("lets a CrossContractCall returnBinding be referenced as an invocationArg in a downstream Condition", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({
          id: "2",
          type: "CrossContractCall",
          data: {
            label: "Call",
            params: {
              targetContractId: "C123",
              targetFunction: "balance_of",
              returnBinding: "bal",
              returnType: "i128",
            },
          },
        }),
        node({
          id: "3",
          type: "Condition",
          data: {
            label: "Guard",
            params: {
              conditionExpression: {
                left: { type: "invocationArg", value: "bal" },
                operator: ">",
                right: { type: "constant", value: "0", constantKind: "number" },
              },
            },
          },
        }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    expect(inferGraphTypes(graph).errors).toHaveLength(0)
  })

  it("flags a returnBinding of the wrong type used in a numeric comparison", () => {
    const graph: ContractGraph = {
      nodes: [
        node({ id: "1", type: "default" }),
        node({
          id: "2",
          type: "CrossContractCall",
          data: {
            label: "Call",
            params: {
              targetContractId: "C123",
              targetFunction: "owner",
              returnBinding: "owner_addr",
              returnType: "Address",
            },
          },
        }),
        node({
          id: "3",
          type: "Condition",
          data: {
            label: "Guard",
            params: {
              conditionExpression: {
                left: { type: "invocationArg", value: "owner_addr" },
                operator: ">",
                right: { type: "constant", value: "0", constantKind: "number" },
              },
            },
          },
        }),
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "3" },
      ],
    }

    const { errors } = inferGraphTypes(graph)
    expect(errors).toHaveLength(1)
    expect(errors[0].sourceType).toBe("Address")
  })
})
