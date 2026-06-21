import { describe, expect, it } from "vitest"

import { generateContractTests } from "@/lib/compile/testCodegen"
import type { ContractGraph } from "@/lib/compile/schema"
import type { ContractTestCase } from "@/lib/compile/test-schema"
import tokenTransfer from "@/lib/templates/token-transfer.json"

const transferGraph = tokenTransfer as ContractGraph

describe("generateContractTests", () => {
  it("generates Soroban test module for a graph", () => {
    const testCases: ContractTestCase[] = [
      {
        id: "case_1",
        name: "Transfer succeeds",
        inputs: [
          { name: "caller", type: "address", value: "" },
          { name: "from", type: "address", value: "" },
          { name: "to", type: "address", value: "" },
          { name: "amount", type: "number", value: "100" },
          { name: "token", type: "address", value: "" },
          { name: "event_name", type: "symbol", value: "paid" },
        ],
        expected: { success: true },
      },
    ]

    const source = generateContractTests(transferGraph, testCases)

    expect(source).toContain("mod contract_tests")
    expect(source).toContain("fn lumens_test_case_1")
    expect(source).toContain("env.mock_all_auths")
    expect(source).toContain("register_stellar_asset_contract")
    expect(source).toContain("client.execute(")
  })

  it("marks failing expectations with should_panic", () => {
    const graph: ContractGraph = {
      nodes: [
        { id: "1", type: "default", data: { label: "Start" } },
        { id: "2", type: "Condition", data: { label: "Check release" } },
      ],
      edges: [{ id: "e1", source: "1", target: "2" }],
    }

    const testCases: ContractTestCase[] = [
      {
        id: "fail_case",
        name: "Release denied",
        inputs: [{ name: "release", type: "boolean", value: "false" }],
        expected: { success: false },
      },
    ]

    const source = generateContractTests(graph, testCases)
    expect(source).toContain("#[should_panic]")
    expect(source).toContain("let release = false;")
  })
})
