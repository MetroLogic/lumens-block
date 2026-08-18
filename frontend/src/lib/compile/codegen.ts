import { BlockType, ContractGraph, ContractGraphNode, ConditionExpression, Operand } from "./schema"
import {
  collectCrossContractImports,
  crossContractParams,
  emitCrossContractCall,
  emitCrossContractClients,
  getCrossContractNodes,
} from "./crossContract"
import { validateGraphStructure } from "./validate"

export interface CodegenResult {
  source: string
  sourceHash: string
  blockOrder: string[]
}

export interface FunctionParam {
  name: string
  rustType: string
}

/** Contract error type emitted for graphs containing a Condition block. */
export const GENERATED_ERROR_ENUM = `#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GeneratedError {
    /// A Condition block guard evaluated to false.
    ConditionFailed = 1,
}`

const EXECUTABLE_TYPES = new Set<BlockType>([
  "Auth",
  "Transfer",
  "Storage",
  "Event",
  "Condition",
  "CrossContractCall",
])

/**
 * Returns nodes reachable from Start in breadth-first execution order.
 */
export function getExecutionOrder(graph: ContractGraph): ContractGraphNode[] {
  const start = graph.nodes.find((n) => n.type === "default")
  if (!start) return []

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, string[]>()

  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const visited = new Set<string>()
  const order: ContractGraphNode[] = []
  const queue = [start.id]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeById.get(id)
    if (!node) continue

    if (EXECUTABLE_TYPES.has(node.type)) {
      order.push(node)
    }

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  return order
}

export function getFunctionParamsFromGraph(graph: ContractGraph): FunctionParam[] {
  const executionOrder = getExecutionOrder(graph)
  const blockTypes = new Set(executionOrder.map((n) => n.type))
  return deriveParams(blockTypes, executionOrder)
}

export function paramRustTypeToInputType(rustType: string): "address" | "number" | "boolean" | "symbol" {
  switch (rustType) {
    case "Address":
      return "address"
    case "i128":
      return "number"
    case "bool":
      return "boolean"
    case "Symbol":
      return "symbol"
    default:
      return "symbol"
  }
}

function deriveParams(blockTypes: Set<BlockType>, nodes: ContractGraphNode[] = []): FunctionParam[] {
  const params: FunctionParam[] = [{ name: "env", rustType: "Env" }]

  if (blockTypes.has("Auth") || blockTypes.has("Transfer") || blockTypes.has("Event")) {
    params.push({ name: "caller", rustType: "Address" })
  }

  if (blockTypes.has("Transfer") || blockTypes.has("Event")) {
    params.push({ name: "from", rustType: "Address" })
    params.push({ name: "to", rustType: "Address" })
    params.push({ name: "amount", rustType: "i128" })
  }

  if (blockTypes.has("Transfer")) {
    params.push({ name: "token", rustType: "Address" })
  }

  if (blockTypes.has("Storage")) {
    params.push({ name: "key", rustType: "Symbol" })
    params.push({ name: "value", rustType: "i128" })
  }

  if (blockTypes.has("Condition")) {
    params.push({ name: "release", rustType: "bool" })
  }

  if (blockTypes.has("Event")) {
    params.push({ name: "event_name", rustType: "Symbol" })
  }

  // Arguments and target addresses required by CrossContractCall blocks.
  params.push(...crossContractParams(nodes, params.map((param) => param.name)))

  return params
}

function deriveImports(blockTypes: Set<BlockType>, nodes: ContractGraphNode[] = []): string[] {
  const imports = new Set<string>(["contract", "contractimpl", "Env"])

  if (blockTypes.has("Auth") || blockTypes.has("Transfer") || blockTypes.has("Event")) {
    imports.add("Address")
  }

  if (blockTypes.has("Transfer")) {
    imports.add("token")
  }

  if (blockTypes.has("Storage") || blockTypes.has("Event") || blockTypes.has("Condition")) {
    imports.add("Symbol")
    imports.add("symbol_short")
  }

  if (blockTypes.has("Condition")) {
    imports.add("contracterror")
    imports.add("panic_with_error")
  }

  for (const name of collectCrossContractImports(nodes)) {
    imports.add(name)
  }

  return Array.from(imports).sort()
}

function emitBlock(node: ContractGraphNode, crossCallIndexes: Map<string, number>): string {
  const label = node.data.label.replace(/"/g, '\\"')

  switch (node.type) {
    case "CrossContractCall": {
      const index = crossCallIndexes.get(node.id) ?? 0
      const fn = node.data.params?.targetFunction?.trim()
      return emitCrossContractCall(node, index, fn ? `${label} → ${fn}()` : label)
    }

    case "Auth":
      return `        // ${label}\n        caller.require_auth();`

    case "Transfer":
      return `        // ${label}\n        token::Client::new(&env, &token).transfer(&from, &to, &amount);`

    case "Storage": {
      const key = node.data.params?.storageKey ?? "stored"
      return `        // ${label}\n        env.storage().instance().set(&symbol_short!("${sanitizeSymbol(key)}"), &value);`
    }

    case "Event":
      return `        // ${label}\n        env.events().publish((event_name,), (from.clone(), to.clone(), amount));`

    case "Condition": {
      const expr = node.data.params?.conditionExpression
      if (expr) {
        const rustCondition = buildRustCondition(expr)
        return `        // ${label}\n        if !(${rustCondition}) {\n            panic_with_error!(&env, GeneratedError::ConditionFailed);\n        }`
      }
      // Legacy fallback (no expression defined yet)
      return `        // ${label}\n        if !release {\n            panic_with_error!(&env, GeneratedError::ConditionFailed);\n        }`
    }

    default:
      return ""
  }
}

function sanitizeSymbol(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 9)
  return cleaned.length > 0 ? cleaned : "key"
}

/**
 * Converts a single Operand into its Rust expression representation.
 *
 * - invocationArg  → bare identifier (e.g. `amount`)
 * - storageKey     → env.storage().instance().get::<_, i128>(&symbol_short!("key")).unwrap_or(0)
 * - constant       → typed literal (string → Symbol, number → i128, bool → bool)
 */
function buildRustOperand(op: Operand): string {
  switch (op.type) {
    case "invocationArg":
      return op.value.trim() || "release"
    case "storageKey": {
      const sym = sanitizeSymbol(op.value || "key")
      return `env.storage().instance().get::<_, i128>(&symbol_short!("${sym}")).unwrap_or(0)`
    }
    case "constant": {
      const kind = op.constantKind ?? "string"
      if (kind === "number") return op.value.trim() || "0"
      if (kind === "bool") return op.value === "true" ? "true" : "false"
      // String constant → convert to Symbol for comparison
      return `symbol_short!("${op.value.replace(/"/g, '\\"')}")`
    }
    default:
      return op.value || "release"
  }
}

/**
 * Converts a ConditionExpression into a Rust boolean expression string.
 * The caller wraps it in `if !(…) { panic_with_error!(…) }`.
 */
function buildRustCondition(expr: ConditionExpression): string {
  const left = buildRustOperand(expr.left)
  const right = buildRustOperand(expr.right)
  return `${left} ${expr.operator} ${right}`
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/**
 * Generates Soroban Rust source from a validated contract graph.
 */
export function generateContractSource(graph: ContractGraph): CodegenResult {
  const structureError = validateGraphStructure(graph)
  if (structureError) {
    throw new Error(structureError.message)
  }

  const executionOrder = getExecutionOrder(graph)
  const blockTypes = new Set(executionOrder.map((n) => n.type))

  const imports = deriveImports(blockTypes, executionOrder)
  const params = deriveParams(blockTypes, executionOrder)
  const paramList = params.map((p) => `${p.name}: ${p.rustType}`).join(", ")

  const crossCallIndexes = new Map(
    getCrossContractNodes(executionOrder).map((node, index) => [node.id, index])
  )
  const body = executionOrder
    .map((node) => emitBlock(node, crossCallIndexes))
    .filter(Boolean)
    .join("\n\n")

  const clients = emitCrossContractClients(executionOrder)
  const declarations = [blockTypes.has("Condition") ? GENERATED_ERROR_ENUM : "", clients]
    .filter(Boolean)
    .join("\n\n")

  const source = `#![no_std]
use soroban_sdk::{${imports.join(", ")}};
${declarations ? `\n${declarations}\n` : ""}
#[contract]
pub struct LumensBlockGenerated;

#[contractimpl]
impl LumensBlockGenerated {
    /// Generated entry point from LumensBlock visual graph.
    pub fn execute(${paramList}) {
${body}
    }
}
`

  return {
    source,
    sourceHash: fnv1aHash(source),
    blockOrder: executionOrder.map((n) => `${n.type}:${n.id}`),
  }
}

export const GENERATED_CARGO_TOML = `[package]
name = "lumens-block-generated"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
`

export const GENERATED_TEST_CARGO_TOML = `[package]
name = "lumens-block-generated"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["alloc", "testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
`
