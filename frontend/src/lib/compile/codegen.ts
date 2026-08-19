import { BlockType, ContractGraph, ContractGraphNode, ConditionExpression, Operand, StorageScope } from "./schema"
import {
  collectCrossContractImports,
  crossContractParams,
  emitCrossContractCall,
  emitCrossContractClients,
  getCrossContractNodes,
} from "./crossContract"
import {
  EXECUTABLE_TYPES,
  collectFunctionGroups,
  hasFunctionEntries,
  type FunctionGroup,
} from "./functions"
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

/**
 * Returns executable nodes in breadth-first execution order.
 *
 * With no `rootId` the traversal starts at the Start node, which is the
 * single-root behaviour every graph without `FunctionEntry` blocks relies on.
 * Passing an explicit root walks one function subgraph instead, stopping at
 * `FunctionReturn` nodes so a function body never bleeds into the next.
 */
export function getExecutionOrder(graph: ContractGraph, rootId?: string): ContractGraphNode[] {
  const start = rootId
    ? graph.nodes.find((n) => n.id === rootId)
    : graph.nodes.find((n) => n.type === "default")
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

    // A return terminates the branch; nothing past it belongs to this function.
    if (node.type === "FunctionReturn") continue

    if (EXECUTABLE_TYPES.has(node.type)) {
      order.push(node)
    }

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  return order
}

/**
 * Returns the invocation parameters of a graph's entry point.
 *
 * For a multi-function graph this describes the first declared function, which
 * is what the test and invoke panels drive; single-root graphs are unchanged.
 */
export function getFunctionParamsFromGraph(graph: ContractGraph): FunctionParam[] {
  if (hasFunctionEntries(graph)) {
    const collected = collectFunctionGroups(graph)
    if (collected.ok && collected.groups.length > 0) {
      return functionSignature(collected.groups[0])
    }
  }

  const executionOrder = getExecutionOrder(graph)
  const blockTypes = new Set(executionOrder.map((n) => n.type))
  return deriveParams(blockTypes, executionOrder)
}

/**
 * Builds one function's full parameter list.
 *
 * `env` always comes first, then the parameters the author declared on the
 * entry block, then any parameter the body's blocks reference implicitly
 * (`caller`, `amount`, …) that the author did not already declare — without
 * those the emitted body would not compile.
 */
export function functionSignature(group: FunctionGroup): FunctionParam[] {
  const params: FunctionParam[] = [{ name: "env", rustType: "Env" }]
  const seen = new Set<string>(["env"])

  for (const declared of group.declaredParams) {
    if (seen.has(declared.name)) continue
    seen.add(declared.name)
    params.push({ name: declared.name, rustType: declared.rustType })
  }

  const blockTypes = new Set(group.body.map((n) => n.type))
  for (const derived of deriveParams(blockTypes)) {
    if (seen.has(derived.name)) continue
    seen.add(derived.name)
    params.push(derived)
  }

  return params
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
    const hasWriteStorage = nodes.some(
      (n) => n.type === "Storage" && (n.data.params?.storageMode ?? "write") === "write"
    )
    if (hasWriteStorage) {
      params.push({ name: "key", rustType: "Symbol" })
      params.push({ name: "value", rustType: "i128" })
    }
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
      const mode = node.data.params?.storageMode ?? "write"
      const scope = node.data.params?.storageScope ?? "instance"
      const sym = sanitizeSymbol(key)
      if (mode === "read") {
        // Read-mode nodes emit a standalone getter — nothing in the execute body
        return ""
      }
      return `        // ${label}\n        env.storage().${scope}().set(&symbol_short!("${sym}"), &value);`
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

/**
 * Derives the unwrap_or default value string for a given return type.
 */
function defaultForReturnType(returnType: string): string {
  switch (returnType) {
    case "bool": return "false"
    case "i128": return "0"
    case "Symbol": return "Symbol::short(\"\".as_bytes())"
    case "Address": return 'panic!("not found")'
    default: return "0"
  }
}

/**
 * Emits standalone pub fn get_<key>(env: Env) -> <returnType> functions
 * for each unique read-mode Storage node.
 */
function emitStorageGetters(nodes: ContractGraphNode[]): string {
  const seen = new Set<string>()
  const fns: string[] = []

  for (const node of nodes) {
    if (node.type !== "Storage") continue
    const mode = node.data.params?.storageMode ?? "write"
    if (mode !== "read") continue

    const key = node.data.params?.storageKey ?? "stored"
    const sym = sanitizeSymbol(key)
    if (seen.has(sym)) continue
    seen.add(sym)

    const scope: StorageScope = node.data.params?.storageScope ?? "instance"
    const returnType = node.data.params?.storageReturnType ?? "i128"
    const fnName = `get_${sym}`
    const defaultVal = defaultForReturnType(returnType)

    fns.push(
      `    /// Generated getter for storage key "${sym}".\n` +
      `    pub fn ${fnName}(env: Env) -> ${returnType} {\n` +
      `        env.storage().${scope}()\n` +
      `            .get::<_, ${returnType}>(&symbol_short!("${sym}"))\n` +
      `            .unwrap_or(${defaultVal})\n` +
      `    }`
    )
  }

  return fns.join("\n\n")
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

  if (hasFunctionEntries(graph)) {
    return generateMultiFunctionSource(graph)
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

  const getters = emitStorageGetters(executionOrder)

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
${getters ? `\n${getters}\n` : ""}}
`

  return {
    source,
    sourceHash: fnv1aHash(source),
    blockOrder: executionOrder.map((n) => `${n.type}:${n.id}`),
  }
}

/**
 * Emits one `pub fn` per FunctionEntry inside a single `#[contractimpl]` block.
 */
function generateMultiFunctionSource(graph: ContractGraph): CodegenResult {
  const collected = collectFunctionGroups(graph)
  if (!collected.ok) {
    throw new Error(collected.error.message)
  }

  const { groups } = collected

  const allBlockTypes = new Set<BlockType>()
  for (const group of groups) {
    for (const node of group.body) allBlockTypes.add(node.type)
  }

  const allBodyNodes = groups.flatMap((group) => group.body)

  const needsSymbolShort = groups.some(
    (g) => g.returnValue !== null && g.returnValue.includes("symbol_short!")
  )
  const imports = deriveImports(allBlockTypes, allBodyNodes)
  if (needsSymbolShort && !imports.includes("symbol_short")) {
    imports.push("Symbol", "symbol_short")
    imports.sort()
  }

  const functions = groups.map((group) => emitFunction(group)).join("\n\n")

  // Client traits and the error enum are module-level, so they are emitted once
  // for every cross-contract call and Condition block across all functions.
  const clients = emitCrossContractClients(allBodyNodes)
  const declarations = [allBlockTypes.has("Condition") ? GENERATED_ERROR_ENUM : "", clients]
    .filter(Boolean)
    .join("\n\n")

  const source = `#![no_std]
use soroban_sdk::{${imports.join(", ")}};
${declarations ? `\n${declarations}\n` : ""}
#[contract]
pub struct LumensBlockGenerated;

#[contractimpl]
impl LumensBlockGenerated {
${functions}
}
`

  const blockOrder: string[] = []
  for (const group of groups) {
    for (const node of group.body) blockOrder.push(`${node.type}:${node.id}`)
  }

  return {
    source,
    sourceHash: fnv1aHash(source),
    blockOrder,
  }
}

/** Renders one function group as a Rust method. */
function emitFunction(group: FunctionGroup): string {
  const params = functionSignature(group)
  const paramList = params.map((p) => `${p.name}: ${p.rustType}`).join(", ")
  const returnClause = group.returnType === "()" ? "" : ` -> ${group.returnType}`

  // Cross-contract call slots are numbered per function: each function declares
  // its own `target_contract`, `target_contract_2`, … parameters.
  const crossCallIndexes = new Map(
    getCrossContractNodes(group.body).map((node, index) => [node.id, index])
  )

  const statements = group.body
    .map((node) => emitBlock(node, crossCallIndexes))
    .filter(Boolean)
  if (group.returnValue !== null) {
    statements.push(`        ${group.returnValue}`)
  }

  const label = group.entry.data.label.replace(/"/g, '\\"')
  const body = statements.join("\n\n")

  return `    /// Generated from FunctionEntry "${label}".
    ${group.visibility} fn ${group.name}(${paramList})${returnClause} {
${body}
    }`
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
