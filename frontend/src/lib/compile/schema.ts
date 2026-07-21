/**
 * JSON schema types for the LumensBlock contract graph.
 * Captures node types, parameters, and edges independent of React Flow runtime types.
 */

// ---------------------------------------------------------------------------
// Condition expression model
// ---------------------------------------------------------------------------

/** The kind of value that can appear on either side of a condition. */
export type OperandType = "constant" | "storageKey" | "invocationArg"

/** A single operand in a condition expression. */
export interface Operand {
  /** Discriminator: how the value is sourced. */
  type: OperandType
  /**
   * For "constant"   → the literal value (string | number | boolean).
   * For "storageKey" → the storage key name string.
   * For "invocationArg" → the argument name string (e.g. "amount", "caller").
   */
  value: string
  /**
   * For "constant" only: the Rust primitive type of the literal.
   * Defaults to "string" if omitted.
   */
  constantKind?: "string" | "number" | "bool"
}

/** Comparison operators supported by the expression builder. */
export type Operator = "==" | "!=" | ">" | "<" | ">=" | "<="

export const OPERATORS: Operator[] = ["==", "!=", ">", "<", ">=", "<="]

/**
 * Structured condition expression.
 * Serialised into node data and consumed by codegen to produce a Rust `if` guard.
 */
export interface ConditionExpression {
  left: Operand
  operator: Operator
  right: Operand
}

export const BLOCK_TYPES = [
  "default",
  "Condition",
  "Transfer",
  "Storage",
  "Event",
  "Auth",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export interface BlockParameters {
  /** Token contract address for Transfer blocks */
  token?: string
  /** Storage key for Storage blocks */
  storageKey?: string
  /** Event name for Event blocks */
  eventName?: string
  /** Condition expression label for Condition blocks (legacy free-text, kept for backward compat) */
  condition?: string
  /**
   * Structured condition expression for Condition blocks.
   * Takes precedence over the legacy `condition` string during codegen.
   */
  conditionExpression?: ConditionExpression
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
