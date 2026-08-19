import {
  BlockType,
  ConditionExpression,
  ContractGraph,
  ContractGraphNode,
  Operand,
  StorageScope,
} from "../compile/schema"
import { GENERATED_ERROR_ENUM } from "../compile/codegen"
import {
  collectCrossContractImports,
  crossContractParams,
  emitCrossContractCall,
  emitCrossContractClients,
  getCrossContractNodes,
} from "../compile/crossContract"

export type { ContractGraph, ContractGraphNode, ContractGraphEdge } from "../compile/schema"

const EXECUTABLE_TYPES = new Set<BlockType>([
  "Auth",
  "Transfer",
  "Storage",
  "Event",
  "Condition",
  "CrossContractCall",
])

export interface CompileGraphOptions {
  /** Callback or array to collect warnings */
  onWarning?: (warning: string) => void
}

/**
 * Performs a topological sort on reachable nodes starting from the 'default' (Start) node.
 * Detects cycles and throws an error if any cycle exists in the graph.
 * Triggers warnings for disconnected nodes (nodes not reachable from Start).
 */
export function topologicalSort(
  graph: ContractGraph,
  options?: CompileGraphOptions
): ContractGraphNode[] {
  const startNode = graph.nodes.find((n) => n.type === "default")
  if (!startNode) {
    throw new Error("Graph must include a Start node (type 'default').")
  }

  const nodeMap = new Map<string, ContractGraphNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  // Build adjacency list for all edges
  const adjacency = new Map<string, string[]>()

  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
  }

  for (const edge of graph.edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target)
    }
  }

  // Determine reachability from Start node
  const reachable = new Set<string>()
  const queueReach: string[] = [startNode.id]

  while (queueReach.length > 0) {
    const current = queueReach.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!reachable.has(neighbor)) {
        queueReach.push(neighbor)
      }
    }
  }

  // Check for disconnected nodes and trigger warnings
  const disconnectedNodes = graph.nodes.filter((n) => !reachable.has(n.id))
  for (const node of disconnectedNodes) {
    const warningMsg = `Warning: Disconnected node "${node.id}" (${node.data?.label ?? node.type}) is not reachable from Start.`
    if (options?.onWarning) {
      options.onWarning(warningMsg)
    }
    console.warn(warningMsg)
  }

  // Check for cycles within reachable nodes using DFS (3-color approach: 0=unvisited, 1=visiting, 2=visited)
  const visitState = new Map<string, number>()
  for (const id of reachable) {
    visitState.set(id, 0)
  }

  function dfsCycleCheck(nodeId: string): boolean {
    visitState.set(nodeId, 1) // visiting
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!reachable.has(neighbor)) continue
      const state = visitState.get(neighbor)
      if (state === 1) {
        // Back edge detected -> cycle!
        return true
      }
      if (state === 0) {
        if (dfsCycleCheck(neighbor)) return true
      }
    }
    visitState.set(nodeId, 2) // visited
    return false
  }

  if (dfsCycleCheck(startNode.id)) {
    throw new Error("Cyclic graph detected: graph contains a cycle.")
  }

  // Calculate in-degrees restricted to reachable nodes
  const reachableInDegree = new Map<string, number>()
  for (const id of reachable) {
    reachableInDegree.set(id, 0)
  }

  for (const edge of graph.edges) {
    if (reachable.has(edge.source) && reachable.has(edge.target)) {
      reachableInDegree.set(edge.target, (reachableInDegree.get(edge.target) ?? 0) + 1)
    }
  }

  // Kahn's algorithm for topological sorting on reachable nodes
  const queue: string[] = []
  for (const id of reachable) {
    if (reachableInDegree.get(id) === 0) {
      queue.push(id)
    }
  }

  const sortedOrder: ContractGraphNode[] = []

  while (queue.length > 0) {
    const currId = queue.shift()!
    const node = nodeMap.get(currId)
    if (node) {
      sortedOrder.push(node)
    }

    for (const nextId of adjacency.get(currId) ?? []) {
      if (!reachable.has(nextId)) continue
      const deg = (reachableInDegree.get(nextId) ?? 1) - 1
      reachableInDegree.set(nextId, deg)
      if (deg === 0) {
        queue.push(nextId)
      }
    }
  }

  // Filter only executable block types
  return sortedOrder.filter((n) => EXECUTABLE_TYPES.has(n.type))
}

/**
 * Generates Soroban Rust source code from each node type in topological order.
 */
export function compileGraph(graph: ContractGraph, options?: CompileGraphOptions): string {
  const executionOrder = topologicalSort(graph, options)
  const blockTypes = new Set(executionOrder.map((n) => n.type))

  const imports = deriveImports(blockTypes, executionOrder)
  const params = deriveParams(blockTypes, executionOrder)
  const paramList = params.map((p) => `${p.name}: ${p.rustType}`).join(", ")

  const crossCallIndexes = new Map(
    getCrossContractNodes(executionOrder).map((node, index) => [node.id, index])
  )
  const body = executionOrder
    .map((node) => emitNodeCode(node, crossCallIndexes))
    .filter(Boolean)
    .join("\n\n")

  const clients = emitCrossContractClients(executionOrder)
  const declarations = [blockTypes.has("Condition") ? GENERATED_ERROR_ENUM : "", clients]
    .filter(Boolean)
    .join("\n\n")

  const getters = emitStorageGetters(executionOrder)

  return `#![no_std]
use soroban_sdk::{${imports.join(", ")}};
${declarations ? `\n${declarations}\n` : ""}
#[contract]
pub struct LumensBlockContract;

#[contractimpl]
impl LumensBlockContract {
    /// Generated contract entry-point signature.
    pub fn execute(${paramList}) {
${body.length > 0 ? body : "        // No executable nodes"}
    }
${getters ? `\n${getters}\n` : ""}}
`
}

function defaultForReturnType(returnType: string): string {
  switch (returnType) {
    case "bool": return "false"
    case "i128": return "0"
    default: return "0"
  }
}

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
    const defaultVal = defaultForReturnType(returnType)

    fns.push(
      `    /// Generated getter for storage key "${sym}".\n` +
      `    pub fn get_${sym}(env: Env) -> ${returnType} {\n` +
      `        env.storage().${scope}()\n` +
      `            .get::<_, ${returnType}>(&symbol_short!("${sym}"))\n` +
      `            .unwrap_or(${defaultVal})\n` +
      `    }`
    )
  }

  return fns.join("\n\n")
}

function deriveParams(
  blockTypes: Set<BlockType>,
  nodes: ContractGraphNode[] = []
): Array<{ name: string; rustType: string }> {
  const params: Array<{ name: string; rustType: string }> = [{ name: "env", rustType: "Env" }]

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

function emitNodeCode(node: ContractGraphNode, crossCallIndexes: Map<string, number>): string {
  const label = node.data.label.replace(/"/g, '\\"')

  switch (node.type) {
    case "CrossContractCall": {
      const index = crossCallIndexes.get(node.id) ?? 0
      const fn = node.data.params?.targetFunction?.trim()
      return emitCrossContractCall(
        node,
        index,
        fn ? `CrossContractCall: ${label} → ${fn}()` : `CrossContractCall: ${label}`
      )
    }

    case "Auth":
      return `        // Auth: ${label}\n        caller.require_auth();`

    case "Transfer":
      return `        // Transfer: ${label}\n        token::Client::new(&env, &token).transfer(&from, &to, &amount);`

    case "Storage": {
      const key = node.data.params?.storageKey ?? "key"
      const mode = node.data.params?.storageMode ?? "write"
      const scope: StorageScope = node.data.params?.storageScope ?? "instance"
      const sym = sanitizeSymbol(key)
      if (mode === "read") return ""
      return `        // Storage: ${label}\n        env.storage().${scope}().set(&symbol_short!("${sym}"), &value);`
    }

    case "Event":
      return `        // Event: ${label}\n        env.events().publish((event_name,), (from.clone(), to.clone(), amount));`

    case "Condition": {
      const expr = node.data.params?.conditionExpression
      if (expr) {
        const rustCondition = buildRustCondition(expr)
        return `        // Condition: ${label}\n        if !(${rustCondition}) {\n            panic_with_error!(&env, GeneratedError::ConditionFailed);\n        }`
      }
      return `        // Condition: ${label}\n        if !release {\n            panic_with_error!(&env, GeneratedError::ConditionFailed);\n        }`
    }

    default:
      return ""
  }
}

function sanitizeSymbol(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 9)
  return cleaned.length > 0 ? cleaned : "key"
}

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
      return `symbol_short!("${op.value.replace(/"/g, '\\"')}")`
    }
    default:
      return op.value || "release"
  }
}

function buildRustCondition(expr: ConditionExpression): string {
  const left = buildRustOperand(expr.left)
  const right = buildRustOperand(expr.right)
  return `${left} ${expr.operator} ${right}`
}
