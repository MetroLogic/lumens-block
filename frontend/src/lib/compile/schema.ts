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
  "CrossContractCall",
  "FunctionEntry",
  "FunctionReturn",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

/** Storage mode for Storage blocks. */
export type StorageMode = "read" | "write"

/** Storage scope for Storage blocks. */
export type StorageScope = "instance" | "persistent" | "temporary"

/** Asset kind selectable on Transfer blocks. */
export type AssetKind = "xlm" | "sac"

/**
 * Structured asset selection for Transfer blocks.
 * Persisted in node data; `token` is kept in sync with `contractId` for readers that expect a string.
 */
export interface TransferAsset {
  kind: AssetKind
  /** Resolved SAC contract address (native XLM SAC or custom). */
  contractId?: string
  /** Token symbol from SAC metadata (e.g. "XLM", "USDC"). */
  symbol?: string
  /** Token name from SAC metadata. */
  name?: string
}

/** Rust primitive types accepted for cross-contract call arguments and return values. */
export const CROSS_CONTRACT_TYPES = ["Address", "i128", "Symbol", "bool"] as const

export type CrossContractType = (typeof CROSS_CONTRACT_TYPES)[number]

/** Where the value of a cross-contract argument comes from. */
export const CROSS_CONTRACT_ARG_SOURCES = ["literal", "storageKey", "invocationArg"] as const

export type CrossContractArgSource = (typeof CROSS_CONTRACT_ARG_SOURCES)[number]

/** A single ordered argument passed to an external contract function. */
export interface CrossContractArg {
  /** Parameter name used in the generated client trait (e.g. "amount"). */
  name: string
  /**
   * The operand value.
   * - "literal"        → the literal itself (e.g. "100", "true", "GC…"/"C…" address, symbol text)
   * - "storageKey"     → the instance-storage key to read from
   * - "invocationArg"  → the name of an `execute` parameter (e.g. "caller", "amount")
   */
  value: string
  /** Rust type of the argument in the target contract's signature. */
  rustType: string
  /** How `value` is sourced. Defaults to "literal" when omitted. */
  source?: CrossContractArgSource
}

export function isCrossContractType(value: unknown): value is CrossContractType {
  return typeof value === "string" && CROSS_CONTRACT_TYPES.includes(value as CrossContractType)
}

export function isCrossContractArgSource(value: unknown): value is CrossContractArgSource {
  return (
    typeof value === "string" &&
    CROSS_CONTRACT_ARG_SOURCES.includes(value as CrossContractArgSource)
  )
}

/**
 * A single declared parameter on a FunctionEntry block.
 * `rustType` is emitted verbatim into the generated signature after validation.
 */
export interface FunctionParamConfig {
  name: string
  rustType: string
}

/** Visibility modifier a FunctionEntry block can emit. */
export type FunctionVisibility = "pub" | "pub(crate)"

export const FUNCTION_VISIBILITIES: FunctionVisibility[] = ["pub", "pub(crate)"]

/** Maximum parameters a single FunctionEntry may declare. */
export const MAX_FUNCTION_PARAMS = 10

/** Rust identifiers accepted for function and parameter names. */
export const RUST_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/

/**
 * Characters allowed in a user-supplied Rust type string.
 *
 * Deliberately an allowlist: it accepts the shapes a Soroban signature needs
 * (`i128`, `Vec<Address>`, `(u32, bool)`, `&Env`) while rejecting anything that
 * could close the signature and inject statements — `;`, `{`, `}` and friends.
 */
export const RUST_TYPE_PATTERN = /^[A-Za-z0-9_<>,:&()[\] ]+$/

export interface BlockParameters {
  /** Token contract address for Transfer blocks (synced from `asset.contractId` when set) */
  token?: string
  /** Structured asset selection for Transfer blocks (XLM or custom SAC) */
  asset?: TransferAsset
  /** Storage key for Storage blocks */
  storageKey?: string
  /** Storage mode: "write" (default) emits a set call; "read" emits a standalone getter function */
  storageMode?: StorageMode
  /** Storage scope: which Soroban storage tier to use (default: "instance") */
  storageScope?: StorageScope
  /** Return type for read-mode Storage blocks (default: "i128") */
  storageReturnType?: "i128" | "bool" | "Symbol" | "Address"
  /** Event name for Event blocks */
  eventName?: string
  /** Condition expression label for Condition blocks (legacy free-text, kept for backward compat) */
  condition?: string
  /**
   * Structured condition expression for Condition blocks.
   * Takes precedence over the legacy `condition` string during codegen.
   */
  conditionExpression?: ConditionExpression
  /** Deployed contract address invoked by a CrossContractCall block. */
  targetContractId?: string
  /** Function name invoked on the target contract. */
  targetFunction?: string
  /** Ordered argument list passed to `targetFunction`. */
  targetArgs?: CrossContractArg[]
  /**
   * Name the return value is bound to in the generated source.
   * When set, downstream Condition blocks can reference it as an `invocationArg` operand.
   */
  returnBinding?: string
  /**
   * Rust return type.
   *
   * On a CrossContractCall block this types the value bound by `returnBinding`
   * and defaults to `"i128"`. On a FunctionReturn block it is the enclosing
   * function's return type and defaults to `"()"`.
   */
  returnType?: string
  /** Emitted function name for FunctionEntry blocks (a valid Rust identifier). */
  functionName?: string
  /** Visibility modifier for FunctionEntry blocks. Defaults to `pub`. */
  visibility?: FunctionVisibility
  /** Declared parameters for FunctionEntry blocks, in signature order after `env`. */
  functionParams?: FunctionParamConfig[]
  /**
   * Expression returned by a FunctionReturn block.
   *
   * Optional: when omitted, codegen emits a zero value for the declared
   * `returnType` so the generated crate still compiles.
   */
  returnValue?: string
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
