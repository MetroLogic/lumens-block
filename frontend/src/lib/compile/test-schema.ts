export type ContractTestInputType = "address" | "number" | "boolean" | "symbol"

export interface ContractTestInput {
  name: string
  type: ContractTestInputType
  value: string
}

export interface ContractTestExpected {
  /** Whether the contract call should complete without error. */
  success: boolean
  /** Optional expected return value (for future non-void contracts). */
  output?: string
}

export interface ContractTestCase {
  id: string
  name: string
  inputs: ContractTestInput[]
  expected: ContractTestExpected
}

export interface ContractTestCaseResult {
  id: string
  name: string
  passed: boolean
  output?: string
  error?: string
}

export interface ContractTestRunResult {
  allPassed: boolean
  sourceHash: string
  sizeBytes: number
  cases: ContractTestCaseResult[]
  /** Raw cargo test output when compilation or the test harness fails. */
  output?: string
}

export interface ContractTestRequest {
  graph: {
    nodes: unknown[]
    edges: unknown[]
  }
  testCases: ContractTestCase[]
}

export const MAX_TEST_CASES = 20
