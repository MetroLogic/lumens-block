import { BlockType, ContractGraph, ContractGraphNode } from "./schema"
import {
  getConditionInvocationArguments,
  parseConditionExpression,
  validateConditionExpression,
} from "./conditionExpression"
import type { ConditionExpression, ConditionOperand, ConditionValueType } from "./schema"
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

const EXECUTABLE_TYPES = new Set<BlockType>([
  "Auth",
  "Transfer",
  "Storage",
  "Event",
  "Condition",
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

function conditionValueTypeToRustType(valueType: ConditionValueType): FunctionParam["rustType"] {
  switch (valueType) {
    case "number":
      return "i128"
    case "boolean":
      return "bool"
    case "string":
    default:
      return "Symbol"
  }
}

function deriveParams(
  blockTypes: Set<BlockType>,
  executionOrder: ContractGraphNode[] = []
): FunctionParam[] {
  const params: FunctionParam[] = [{ name: "env", rustType: "Env" }]
  const paramNames = new Set(params.map((param) => param.name))

  const addParam = (param: FunctionParam) => {
    if (paramNames.has(param.name)) return
    paramNames.add(param.name)
    params.push(param)
  }

  if (blockTypes.has("Auth") || blockTypes.has("Transfer") || blockTypes.has("Event")) {
    addParam({ name: "caller", rustType: "Address" })
  }

  if (blockTypes.has("Transfer") || blockTypes.has("Event")) {
    addParam({ name: "from", rustType: "Address" })
    addParam({ name: "to", rustType: "Address" })
    addParam({ name: "amount", rustType: "i128" })
  }

  if (blockTypes.has("Transfer")) {
    addParam({ name: "token", rustType: "Address" })
  }

  if (blockTypes.has("Storage")) {
    addParam({ name: "key", rustType: "Symbol" })
    addParam({ name: "value", rustType: "i128" })
  }

  if (blockTypes.has("Condition")) {
    const conditionNodes = executionOrder.filter((node) => node.type === "Condition")
    let needsReleaseFallback = false

    for (const node of conditionNodes) {
      const expression = parseConditionExpression(node.data.params?.expression)
      if (!expression || !validateConditionExpression(expression).ok) {
        needsReleaseFallback = true
        continue
      }

      for (const arg of getConditionInvocationArguments(expression)) {
        addParam({ name: arg.name, rustType: conditionValueTypeToRustType(arg.valueType) })
      }
    }

    if (needsReleaseFallback) {
      addParam({ name: "release", rustType: "bool" })
    }
  }

  if (blockTypes.has("Event")) {
    addParam({ name: "event_name", rustType: "Symbol" })
  }

  return params
}

function deriveImports(blockTypes: Set<BlockType>): string[] {
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
    imports.add("panic_with_error")
  }

  return Array.from(imports).sort()
}

function emitBlock(node: ContractGraphNode): string {
  const label = node.data.label.replace(/"/g, '\\"')

  switch (node.type) {
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

    case "Condition":
      return emitConditionBlock(label, node.data.params?.expression)

    default:
      return ""
  }
}

function emitConditionBlock(label: string, rawExpression: unknown): string {
  const expression = parseConditionExpression(rawExpression)

  if (!expression || !validateConditionExpression(expression).ok) {
    return `        // ${label}\n        if !release {\n            panic_with_error!(&env, symbol_short!("cond"));\n        }`
  }

  const condition = emitConditionExpression(expression)
  return `        // ${label}\n        if !(${condition}) {\n            panic_with_error!(&env, symbol_short!("cond"));\n        }`
}

function emitConditionExpression(expression: ConditionExpression): string {
  const left = emitOperandExpression(expression.left)
  const right = emitOperandExpression(expression.right)
  return `${left} ${expression.operator} ${right}`
}

function emitOperandExpression(operand: ConditionOperand): string {
  if (operand.kind === "argument") {
    return operand.name?.trim() || "release"
  }

  if (operand.kind === "storage") {
    const key = sanitizeSymbol(operand.name ?? "stored")
    const fallback = conditionFallbackExpression(operand.valueType)
    const rustType = conditionValueTypeToRustType(operand.valueType)
    return `env.storage().instance().get::<Symbol, ${rustType}>(&symbol_short!("${key}")).unwrap_or(${fallback})`
  }

  return conditionConstantExpression(operand.valueType, operand.value ?? "")
}

function conditionFallbackExpression(valueType: ConditionValueType): string {
  switch (valueType) {
    case "number":
      return "0i128"
    case "boolean":
      return "false"
    case "string":
    default:
      return 'symbol_short!("unset")'
  }
}

function conditionConstantExpression(valueType: ConditionValueType, value: string): string {
  const trimmed = value.trim()

  switch (valueType) {
    case "number":
      return `${trimmed || "0"}i128`
    case "boolean":
      return trimmed === "true" ? "true" : "false"
    case "string":
    default:
      return `symbol_short!("${sanitizeSymbol(trimmed || "value")}")`
  }
}

function sanitizeSymbol(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 9)
  return cleaned.length > 0 ? cleaned : "key"
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

  const imports = deriveImports(blockTypes)
  const params = deriveParams(blockTypes, executionOrder)
  const paramList = params.map((p) => `${p.name}: ${p.rustType}`).join(", ")
  const body = executionOrder.map(emitBlock).filter(Boolean).join("\n\n")

  const source = `#![no_std]
use soroban_sdk::{${imports.join(", ")}};

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
