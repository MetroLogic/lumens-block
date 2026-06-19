import type { Edge, Node } from "reactflow"

import type { CompileError } from "@/lib/compile/schema"
import type {
  ContractTestCase,
  ContractTestInput,
  ContractTestRunResult,
} from "@/lib/compile/test-schema"
import { getFunctionParamsFromGraph, paramRustTypeToInputType } from "@/lib/compile/codegen"
import { normalizeReactFlowGraph } from "@/lib/compile/validate"

export class ContractTestError extends Error {
  readonly code: string
  readonly details?: string[]

  constructor(error: CompileError) {
    super(error.message)
    this.name = "ContractTestError"
    this.code = error.code
    this.details = error.details
  }
}

export type { ContractTestCase, ContractTestInput, ContractTestRunResult }

function createTestCaseId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Infer test inputs from the contract graph using the same parameter names as codegen.
 */
export function inferTestInputsFromGraph(graph: {
  nodes: Node[]
  edges: Edge[]
}): ContractTestInput[] {
  const normalized = normalizeReactFlowGraph(graph)
  return getFunctionParamsFromGraph(normalized)
    .filter((param) => param.name !== "env")
    .map((param) => ({
      name: param.name,
      type: paramRustTypeToInputType(param.rustType),
      value: defaultValueForType(paramRustTypeToInputType(param.rustType)),
    }))
}

function defaultValueForType(type: ContractTestInput["type"]): string {
  switch (type) {
    case "number":
      return "100"
    case "boolean":
      return "true"
    case "symbol":
      return "event"
    case "address":
    default:
      return ""
  }
}

export function createDefaultTestCase(graph: {
  nodes: Node[]
  edges: Edge[]
}): ContractTestCase {
  return {
    id: createTestCaseId(),
    name: "Default test",
    inputs: inferTestInputsFromGraph(graph),
    expected: { success: true },
  }
}

/**
 * Runs contract unit tests against the current graph via POST /api/test.
 */
export async function runContractTestSuite(req: {
  graph: { nodes: Node[]; edges: Edge[] }
  testCases: ContractTestCase[]
}): Promise<ContractTestRunResult> {
  const payload = {
    graph: normalizeReactFlowGraph(req.graph),
    testCases: req.testCases,
  }

  const response = await fetch("/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as ContractTestRunResult | { error: CompileError }

  if (!response.ok) {
    const error = "error" in body ? body.error : { code: "UNKNOWN", message: "Contract tests failed." }
    throw new ContractTestError(error)
  }

  return body as ContractTestRunResult
}
