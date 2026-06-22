/**
 * JSON schema types for the LumensBlock contract graph.
 * Captures node types, parameters, and edges independent of React Flow runtime types.
 */

export const BLOCK_TYPES = [
  "default",
  "Condition",
  "Transfer",
  "Storage",
  "Event",
  "Auth",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const CONDITION_OPERATORS = ["==", "!=", ">", "<", ">=", "<="] as const
export const CONDITION_OPERAND_KINDS = ["argument", "storage", "constant"] as const
export const CONDITION_VALUE_TYPES = ["number", "string", "boolean"] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]
export type ConditionOperandKind = (typeof CONDITION_OPERAND_KINDS)[number]
export type ConditionValueType = (typeof CONDITION_VALUE_TYPES)[number]

export interface ConditionOperand {
  kind: ConditionOperandKind
  valueType: ConditionValueType
  /** Invocation argument name or contract storage key, depending on kind. */
  name?: string
  /** Constant literal value, depending on valueType. */
  value?: string
}

export interface ConditionExpression {
  left: ConditionOperand
  operator: ConditionOperator
  right: ConditionOperand
}

export interface BlockParameters {
  /** Token contract address for Transfer blocks */
  token?: string
  /** Storage key for Storage blocks */
  storageKey?: string
  /** Event name for Event blocks */
  eventName?: string
  /** Condition expression label for Condition blocks */
  condition?: string
  /** Structured expression builder payload for Condition blocks */
  expression?: ConditionExpression
}

export interface ContractGraphNode {
  id: string
  type: BlockType
  /** Canvas position — present in editor graphs, omitted in compile-only payloads. */
  position?: { x: number; y: number }
  data: {
    label: string
    params?: BlockParameters
  }
}

export interface ContractGraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface ContractGraph {
  nodes: ContractGraphNode[]
  edges: ContractGraphEdge[]
}

export interface CompileError {
  code: string
  message: string
  details?: string[]
}

export interface CompileSuccess {
  wasm: string
  sourceHash: string
  sizeBytes: number
}

export type CompileResult =
  | { ok: true; data: CompileSuccess }
  | { ok: false; error: CompileError }

/** Maximum serialized graph payload size (256 KiB). */
export const MAX_GRAPH_BYTES = 256 * 1024

export const MAX_NODES = 100
export const MAX_EDGES = 200

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPES.includes(value as BlockType)
}
