export {
  BLOCK_TYPES,
  MAX_EDGES,
  MAX_GRAPH_BYTES,
  MAX_NODES,
  isBlockType,
} from "./schema"
export type {
  BlockParameters,
  BlockType,
  CompileError,
  CompileResult,
  CompileSuccess,
  ContractGraph,
  ContractGraphEdge,
  ContractGraphNode,
} from "./schema"

export { generateContractSource, getExecutionOrder, GENERATED_CARGO_TOML } from "./codegen"
export type { CodegenResult } from "./codegen"

export {
  normalizeReactFlowGraph,
  validateContractGraph,
  validateGraphStructure,
} from "./validate"

export { compileGraphToWasm, isToolchainAvailable } from "./compiler"
export type { CompileOptions } from "./compiler"

export type {
  ContractTestCase,
  ContractTestCaseResult,
  ContractTestExpected,
  ContractTestInput,
  ContractTestInputType,
  ContractTestRequest,
  ContractTestRunResult,
} from "./test-schema"
export { MAX_TEST_CASES } from "./test-schema"

export { generateContractTests } from "./testCodegen"
export { runContractTests } from "./testRunner"
export type { TestRunOptions } from "./testRunner"
export { getFunctionParamsFromGraph, paramRustTypeToInputType } from "./codegen"
export type { FunctionParam } from "./codegen"
