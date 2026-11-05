/**
 * Editor-time type inference for the LumensBlock contract graph.
 *
 * Edges in this schema encode execution order, not per-value dataflow — a
 * block's Rust-side inputs come from the generated `execute()`/function
 * parameter list (derived from which block types are present) or from a
 * named reference (`invocationArg`, `storageKey`, a CrossContractCall
 * `returnBinding`), never from "whatever node happens to point at me".
 *
 * So the two places a real Rust type mismatch can hide are:
 *   1. A Condition's `conditionExpression`, whose operands resolve to a type
 *      by name and are combined with an operator (see `checkConditionOperands`).
 *   2. A Storage node's declared value type versus an upstream node that
 *      genuinely produces a typed value for it — currently a Storage(read)
 *      node or a CrossContractCall with a `returnBinding` — feeding an edge
 *      directly into a Storage(write) node (see `checkStorageDataEdges`).
 *
 * Side-effect-only blocks (Auth, Transfer, Event) never receive a value via
 * an edge in the current codegen, so they never participate in edge-level
 * mismatches; their declared port types below are informational only.
 */

import {
  type BlockType,
  type ContractGraph,
  type ContractGraphNode,
  type Operand,
  type Operator,
} from "./schema"
import { EXECUTABLE_TYPES, collectFunctionGroups, hasFunctionEntries } from "./functions"

/** Rust types the inference engine understands. */
export type RustType = "Address" | "i128" | "bool" | "Symbol" | "Env"

export interface PortType {
  nodeId: string
  port: "in" | "out" | string
  rustType: RustType
}

export interface TypeMismatchError {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  sourceType: RustType
  targetType: RustType
  message: string
}

export interface TypeInferenceResult {
  portTypes: Map<string, PortType>
  errors: TypeMismatchError[]
}

const RUST_TYPES = new Set<RustType>(["Address", "i128", "bool", "Symbol", "Env"])
const NUMERIC_OPERATORS = new Set<Operator>([">", "<", ">=", "<="])
const EQUALITY_OPERATORS = new Set<Operator>(["==", "!="])

function toRustType(raw: unknown): RustType | null {
  return typeof raw === "string" && RUST_TYPES.has(raw as RustType) ? (raw as RustType) : null
}

function portKey(nodeId: string, port: string): string {
  return `${nodeId}:${port}`
}

/**
 * Declares the ports for the six block types the type-checker table covers.
 * Auth/Transfer/Event ports are informational — see the module comment for
 * why they never trigger an edge mismatch.
 */
function getDeclaredPortTypes(node: ContractGraphNode): PortType[] {
  const at = (port: string, rustType: RustType): PortType => ({ nodeId: node.id, port, rustType })

  switch (node.type) {
    case "Auth":
      return [at("caller", "Address")]
    case "Transfer":
      return [at("from", "Address"), at("to", "Address"), at("amount", "i128"), at("token", "Address")]
    case "Event":
      return [at("from", "Address"), at("to", "Address"), at("amount", "i128")]
    case "Storage": {
      const declared = toRustType(node.data.params?.storageReturnType) ?? "i128"
      const mode = node.data.params?.storageMode ?? "write"
      return [at(mode === "read" ? "out" : "in", declared)]
    }
    case "Condition":
      // Only a *configured* Condition actually produces a bool; an empty
      // one has nothing to type-check downstream of it.
      return node.data.params?.conditionExpression
        ? [at("true", "bool"), at("false", "bool")]
        : []
    case "Loop":
      return [at("items", "i128"), at("result", "i128")]
    default:
      return []
  }
}

/**
 * Assigns Rust types to every node port it can determine, then checks the
 * two real sources of a data-flow type mismatch described in the module
 * comment above.
 */
export function inferGraphTypes(graph: ContractGraph): TypeInferenceResult {
  const portTypes = new Map<string, PortType>()
  const errors: TypeMismatchError[] = []

  for (const node of graph.nodes) {
    for (const port of getDeclaredPortTypes(node)) {
      portTypes.set(portKey(port.nodeId, port.port), port)
    }
  }

  // A CrossContractCall with a returnBinding behaves like a typed output:
  // downstream Condition blocks may reference it by name (see schema.ts).
  for (const node of graph.nodes) {
    if (node.type !== "CrossContractCall") continue
    const binding = node.data.params?.returnBinding?.trim()
    if (!binding) continue
    const rustType = toRustType(node.data.params?.returnType) ?? "i128"
    portTypes.set(portKey(node.id, "out"), { nodeId: node.id, port: "out", rustType })
  }

  checkStorageDataEdges(graph, portTypes, errors)
  checkConditionOperands(graph, errors)

  return { portTypes, errors }
}

/**
 * Flags an edge whose source has a known typed "out" port feeding a
 * Storage(write) node whose declared "in" type disagrees.
 */
function checkStorageDataEdges(
  graph: ContractGraph,
  portTypes: Map<string, PortType>,
  errors: TypeMismatchError[]
): void {
  for (const edge of graph.edges) {
    const outPort = portTypes.get(portKey(edge.source, "out"))
    const inPort = portTypes.get(portKey(edge.target, "in"))
    if (!outPort || !inPort || outPort.rustType === inPort.rustType) continue

    errors.push({
      edgeId: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceType: outPort.rustType,
      targetType: inPort.rustType,
      message:
        `Edge "${edge.id}" carries a ${outPort.rustType} value from node "${edge.source}" into ` +
        `node "${edge.target}", which expects ${inPort.rustType}.`,
    })
  }
}

/**
 * Mirrors codegen.ts#deriveParams's type assignments for the implicit
 * `execute()`/function args a set of block types pulls in. Kept independent
 * of codegen.ts to avoid a validate.ts → typeInference.ts → codegen.ts →
 * validate.ts import cycle; if deriveParams's rules change, update both.
 */
function deriveImplicitArgTypes(
  blockTypes: Set<BlockType>,
  nodes: ContractGraphNode[]
): Map<string, RustType> {
  const scope = new Map<string, RustType>()

  if (blockTypes.has("Auth") || blockTypes.has("Transfer") || blockTypes.has("Event")) {
    scope.set("caller", "Address")
  }
  if (blockTypes.has("Transfer") || blockTypes.has("Event")) {
    scope.set("from", "Address")
    scope.set("to", "Address")
    scope.set("amount", "i128")
  }
  if (blockTypes.has("Transfer")) scope.set("token", "Address")

  if (blockTypes.has("Storage")) {
    const hasWriteStorage = nodes.some(
      (n) => n.type === "Storage" && (n.data.params?.storageMode ?? "write") === "write"
    )
    if (hasWriteStorage) {
      scope.set("key", "Symbol")
      scope.set("value", "i128")
    }
  }

  if (blockTypes.has("Condition")) scope.set("release", "bool")
  if (blockTypes.has("Event")) scope.set("event_name", "Symbol")
  if (blockTypes.has("Loop")) {
    const hasRange = nodes.some(
      (n) => n.type === "Loop" && (n.data.params?.loop?.mode ?? "range") === "range"
    )
    const hasVec = nodes.some((n) => n.type === "Loop" && n.data.params?.loop?.mode === "vec")
    if (hasRange || (blockTypes.has("Loop") && !hasVec)) {
      scope.set("start", "i128")
      scope.set("end", "i128")
    }
  }

  return scope
}

/** BFS execution order restricted to executable nodes, mirroring codegen.ts#getExecutionOrder. */
function computeExecutableNodes(graph: ContractGraph, rootId: string): ContractGraphNode[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const visited = new Set<string>()
  const order: ContractGraphNode[] = []
  const queue = [rootId]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeById.get(id)
    if (!node) continue
    if (node.type === "FunctionReturn") continue
    if (EXECUTABLE_TYPES.has(node.type)) order.push(node)

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  return order
}

/**
 * Builds the invocationArg name → type lookup available at each executable
 * node: implicit params derived from the block types present, declared
 * FunctionEntry params, and in-scope CrossContractCall return bindings.
 */
function buildNodeScopes(graph: ContractGraph): Map<string, Map<string, RustType>> {
  const result = new Map<string, Map<string, RustType>>()

  const addReturnBindings = (scope: Map<string, RustType>, nodes: ContractGraphNode[]) => {
    for (const node of nodes) {
      if (node.type !== "CrossContractCall") continue
      const binding = node.data.params?.returnBinding?.trim()
      if (!binding) continue
      scope.set(binding, toRustType(node.data.params?.returnType) ?? "i128")
    }
  }

  if (hasFunctionEntries(graph)) {
    const collected = collectFunctionGroups(graph)
    if (!collected.ok) return result // structural errors are already surfaced elsewhere

    for (const group of collected.groups) {
      const blockTypes = new Set(group.body.map((n) => n.type))
      const scope = deriveImplicitArgTypes(blockTypes, group.body)
      for (const declared of group.declaredParams) {
        const t = toRustType(declared.rustType)
        if (t) scope.set(declared.name, t)
      }
      addReturnBindings(scope, group.body)
      for (const node of group.body) result.set(node.id, scope)
    }
    return result
  }

  const start = graph.nodes.find((n) => n.type === "default")
  if (!start) return result

  const executable = computeExecutableNodes(graph, start.id)
  const blockTypes = new Set(executable.map((n) => n.type))
  const scope = deriveImplicitArgTypes(blockTypes, executable)
  addReturnBindings(scope, executable)
  for (const node of executable) result.set(node.id, scope)

  return result
}

/**
 * Resolves an operand to a RustType, or null when it can't be determined
 * (an unresolved reference is skipped rather than flagged as a mismatch).
 */
function resolveOperandType(scope: Map<string, RustType>, operand: Operand): RustType | null {
  switch (operand.type) {
    case "invocationArg":
      return scope.get(operand.value.trim()) ?? null
    case "storageKey":
      // buildRustOperand() in codegen.ts always reads storage keys back as
      // i128 (`get::<_, i128>(...)`), regardless of any node's declared
      // storageReturnType, so that is the type actually compiled here.
      return "i128"
    case "constant": {
      const kind = operand.constantKind ?? "string"
      if (kind === "number") return "i128"
      if (kind === "bool") return "bool"
      return "Symbol" // string constants compile to `symbol_short!(...)`
    }
    default:
      return null
  }
}

/** Returns a description of why `left operator right` doesn't type-check, or null when it does. */
function describeConditionMismatch(operator: Operator, left: RustType, right: RustType): string | null {
  if (NUMERIC_OPERATORS.has(operator) && (left !== "i128" || right !== "i128")) {
    return `uses "${operator}" on a non-numeric operand: ${left} ${operator} ${right}.`
  }
  if (EQUALITY_OPERATORS.has(operator) && left !== right) {
    return `compares mismatched types with "${operator}": ${left} vs ${right}.`
  }
  return null
}

function checkConditionOperands(graph: ContractGraph, errors: TypeMismatchError[]): void {
  const nodeScopes = buildNodeScopes(graph)

  for (const node of graph.nodes) {
    if (node.type !== "Condition") continue
    const expr = node.data.params?.conditionExpression
    if (!expr) continue

    const scope = nodeScopes.get(node.id) ?? new Map<string, RustType>()
    const leftType = resolveOperandType(scope, expr.left)
    const rightType = resolveOperandType(scope, expr.right)
    if (!leftType || !rightType) continue // an unresolved name is a config problem, not a type one

    const mismatch = describeConditionMismatch(expr.operator, leftType, rightType)
    if (!mismatch) continue

    // Condition operand types aren't wired through a specific edge, so the
    // edge feeding the Condition node stands in for "which edge to
    // highlight" in the editor.
    const incoming = graph.edges.find((e) => e.target === node.id)

    errors.push({
      edgeId: incoming?.id ?? `condition:${node.id}`,
      sourceNodeId: incoming?.source ?? node.id,
      targetNodeId: node.id,
      sourceType: leftType,
      targetType: rightType,
      message: `Condition "${node.data.label}" (node "${node.id}") ${mismatch}`,
    })
  }
}
