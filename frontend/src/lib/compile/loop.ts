/**
 * Loop block helpers shared by validation, codegen, and the preview compiler.
 *
 * A Loop has three named ports:
 *   - `items` (target)  — exactly one incoming edge
 *   - `body`  (source)  — at least one outgoing edge into the per-iteration subgraph
 *   - `result` (source) — optional sequential continuation after the loop
 *
 * Body edges are followed only when emitting the loop itself so the inner
 * subgraph is not also executed as top-level statements.
 */

import { EXECUTABLE_TYPES } from "./functions"
import {
  DEFAULT_ITERATOR_VAR,
  DEFAULT_LOOP_CONFIG,
  LOOP_BODY_HANDLE,
  LOOP_ITEMS_HANDLE,
  MAX_LOOP_ITERATIONS,
  MIN_LOOP_ITERATIONS,
  RUST_IDENTIFIER_PATTERN,
  isLoopMode,
  type CompileError,
  type ContractGraph,
  type ContractGraphEdge,
  type ContractGraphNode,
  type LoopConfig,
} from "./schema"

function invalid(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

/** True when this edge is the Loop → body-subgraph connection. */
export function isLoopBodyEdge(edge: ContractGraphEdge): boolean {
  return edge.sourceHandle === LOOP_BODY_HANDLE
}

/** True when this edge feeds a Loop's items port (or an unlabeled incoming edge). */
export function isLoopItemsEdge(edge: ContractGraphEdge, loopId: string): boolean {
  if (edge.target !== loopId) return false
  return edge.targetHandle === LOOP_ITEMS_HANDLE || edge.targetHandle == null
}

const RESERVED_ITERATOR_VARS = new Set([
  "env",
  "start",
  "end",
  "items",
  "result",
  "for",
  "let",
  "mut",
  "if",
  "else",
  "fn",
  "self",
  "Self",
  "as",
  "match",
  "loop",
  "while",
  "return",
])

function sanitizeIteratorVar(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_ITERATOR_VAR).trim()
  if (!RUST_IDENTIFIER_PATTERN.test(value) || RESERVED_ITERATOR_VARS.has(value)) {
    return DEFAULT_ITERATOR_VAR
  }
  return value
}

/**
 * Reads and validates a Loop node's config.
 * Returns a CompileError when `maxIterations` is missing or outside [1, 1000].
 */
export function parseLoopConfig(node: ContractGraphNode): LoopConfig | CompileError {
  const raw = node.data.params?.loop
  const maxIterations = raw?.maxIterations

  if (
    typeof maxIterations !== "number" ||
    !Number.isInteger(maxIterations) ||
    maxIterations < MIN_LOOP_ITERATIONS ||
    maxIterations > MAX_LOOP_ITERATIONS
  ) {
    return invalid(
      "INVALID_MAX_ITERATIONS",
      `Loop "${node.data.label}" (node "${node.id}") must have maxIterations between ${MIN_LOOP_ITERATIONS} and ${MAX_LOOP_ITERATIONS}.`,
      [`maxIterations must be an integer in [${MIN_LOOP_ITERATIONS}, ${MAX_LOOP_ITERATIONS}]`]
    )
  }

  if (raw?.mode !== undefined && !isLoopMode(raw.mode)) {
    return invalid(
      "INVALID_LOOP_MODE",
      `Loop "${node.data.label}" (node "${node.id}") has unknown mode "${String(raw.mode)}".`,
      ["range", "vec"]
    )
  }

  return {
    mode: raw?.mode ?? DEFAULT_LOOP_CONFIG.mode,
    maxIterations,
    iteratorVar: sanitizeIteratorVar(raw?.iteratorVar),
  }
}

/**
 * Walks the subgraph connected to a Loop's `body` port in breadth-first order.
 *
 * Nested Loops keep their own body edges; this walk does not cross them.
 * `containsSelf` is true when the Loop appears inside its own body subgraph.
 */
export function getLoopBodyNodes(
  graph: ContractGraph,
  loopId: string
): { nodes: ContractGraphNode[]; containsSelf: boolean } {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, string[]>()

  for (const edge of graph.edges) {
    // Other loops' body edges belong to those loops, not this one.
    if (edge.source !== loopId && isLoopBodyEdge(edge)) continue
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const startTargets = graph.edges
    .filter((edge) => edge.source === loopId && isLoopBodyEdge(edge))
    .map((edge) => edge.target)

  const visited = new Set<string>()
  const order: ContractGraphNode[] = []
  const queue = [...startTargets]
  let containsSelf = startTargets.includes(loopId)

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    if (id === loopId) {
      containsSelf = true
      continue
    }

    const node = nodeById.get(id)
    if (!node) continue

    if (EXECUTABLE_TYPES.has(node.type)) {
      order.push(node)
    }

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  return { nodes: order, containsSelf }
}

/** Every node that lives inside some Loop's body subgraph. */
export function collectAllLoopBodyIds(graph: ContractGraph): Set<string> {
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (node.type !== "Loop") continue
    for (const body of getLoopBodyNodes(graph, node.id).nodes) {
      ids.add(body.id)
    }
  }
  return ids
}

/**
 * Validates every Loop node: iteration cap, items/body wiring, no self-nesting.
 */
export function validateLoopBlocks(graph: ContractGraph): CompileError | null {
  for (const node of graph.nodes) {
    if (node.type !== "Loop") continue

    const config = parseLoopConfig(node)
    if ("code" in config) return config

    const itemsEdges = graph.edges.filter((edge) => isLoopItemsEdge(edge, node.id))
    if (itemsEdges.length !== 1) {
      return invalid(
        "MISSING_LOOP_ITEMS",
        `Loop "${node.data.label}" (node "${node.id}") must have exactly one items input connection.`,
        [`found ${itemsEdges.length} items connection(s)`]
      )
    }

    const bodyEdges = graph.edges.filter(
      (edge) => edge.source === node.id && isLoopBodyEdge(edge)
    )
    if (bodyEdges.length === 0) {
      return invalid(
        "MISSING_LOOP_BODY",
        `Loop "${node.data.label}" (node "${node.id}") must have at least one block connected to its body port.`
      )
    }

    const { containsSelf } = getLoopBodyNodes(graph, node.id)
    if (containsSelf) {
      return invalid(
        "LOOP_SELF_REFERENCE",
        `Loop "${node.data.label}" (node "${node.id}") cannot contain itself in its body subgraph.`
      )
    }
  }

  return null
}

function indentBody(source: string, extraSpaces: number): string {
  if (!source) return ""
  const pad = " ".repeat(extraSpaces)
  return source
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n")
}

/**
 * Emits the bounded Soroban loop. `bodySource` is the already-codegen'd inner
 * subgraph (statements), which is inlined between the iterator binding and the
 * accumulator push.
 *
 * Throws when `maxIterations` is outside [1, 1000] so codegen cannot skip the cap.
 */
export function emitLoopRust(node: ContractGraphNode, bodySource: string): string {
  const parsed = parseLoopConfig(node)
  if ("code" in parsed) {
    throw new Error(parsed.message)
  }

  const { mode, maxIterations, iteratorVar } = parsed
  const inner = indentBody(bodySource, 8)
  const innerBlock = inner ? `\n${inner}` : ""

  if (mode === "vec") {
    return (
      `        // LumensBlock: Loop (vec, max ${maxIterations} iterations)\n` +
      `        let __loop_result: Vec<i128> = {\n` +
      `            let __items = items;\n` +
      `            let __end: u32 = __items.len().min(${maxIterations}u32); // compile-time cap enforced\n` +
      `            let mut __acc: Vec<i128> = Vec::new(&env);\n` +
      `            for __i in 0..__end {\n` +
      `                // --- loop body ---\n` +
      `                let ${iteratorVar} = __items.get(__i).unwrap_or(0);\n` +
      `                let result: i128 = ${iteratorVar};` +
      `${innerBlock}\n` +
      `                __acc.push_back(result);\n` +
      `            }\n` +
      `            __acc\n` +
      `        };`
    )
  }

  return (
    `        // LumensBlock: Loop (range, max ${maxIterations} iterations)\n` +
    `        let __loop_result: Vec<i128> = {\n` +
    `            let __start: i128 = start;\n` +
    `            let __end: i128 = end.min(__start + ${maxIterations}); // compile-time cap enforced\n` +
    `            let mut __acc: Vec<i128> = Vec::new(&env);\n` +
    `            for __i in __start..__end {\n` +
    `                // --- loop body ---\n` +
    `                let ${iteratorVar} = __i;\n` +
    `                let result: i128 = ${iteratorVar};` +
    `${innerBlock}\n` +
    `                __acc.push_back(result);\n` +
    `            }\n` +
    `            __acc\n` +
    `        };`
  )
}

/**
 * True when any Loop in `nodes` iterates a numeric range (the default).
 */
export function graphHasRangeLoop(nodes: ContractGraphNode[]): boolean {
  return nodes.some(
    (n) => n.type === "Loop" && (n.data.params?.loop?.mode ?? "range") === "range"
  )
}

/**
 * True when any Loop in `nodes` iterates a Vec input.
 */
export function graphHasVecLoop(nodes: ContractGraphNode[]): boolean {
  return nodes.some((n) => n.type === "Loop" && n.data.params?.loop?.mode === "vec")
}
