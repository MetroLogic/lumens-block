import type { CompileError, ContractGraph } from "./schema"

const WHITE = 0
const GRAY = 1
const BLACK = 2

/**
 * Returns the node-id path of a directed cycle in `graph`, or `null` if the
 * graph is acyclic.
 *
 * The path includes the repeated start/end id so callers can render
 * `A → B → A`. Only nodes that participate in the cycle are included —
 * ancestors leading into the cycle are omitted.
 *
 * Uses 3-color DFS (white/gray/black) with an explicit path stack so a back
 * edge reconstructs the actual cycle, not just a boolean.
 */
export function findCycle(graph: ContractGraph): string[] | null {
  const adjacency = new Map<string, string[]>()
  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source)
    if (targets) targets.push(edge.target)
  }

  const color = new Map<string, number>()
  for (const node of graph.nodes) {
    color.set(node.id, WHITE)
  }

  function dfs(nodeId: string, path: string[]): string[] | null {
    color.set(nodeId, GRAY)
    path.push(nodeId)

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const neighborColor = color.get(neighbor) ?? WHITE
      if (neighborColor === GRAY) {
        const start = path.indexOf(neighbor)
        if (start === -1) return [neighbor, neighbor]
        return [...path.slice(start), neighbor]
      }
      if (neighborColor === WHITE) {
        const cycle = dfs(neighbor, path)
        if (cycle) return cycle
      }
    }

    path.pop()
    color.set(nodeId, BLACK)
    return null
  }

  for (const node of graph.nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      const cycle = dfs(node.id, [])
      if (cycle) return cycle
    }
  }

  return null
}

/** Human-readable cycle path using node labels, falling back to ids. */
export function formatCycleMessage(graph: ContractGraph, path: string[]): string {
  const names = path.map((id) => {
    const node = graph.nodes.find((n) => n.id === id)
    return node?.data.label?.trim() || id
  })
  return `Cycle detected: ${names.join(" → ")}`
}

/** Structured validation error for a cyclic graph. */
export function cycleValidationError(graph: ContractGraph, path: string[]): CompileError {
  return {
    code: "CYCLE_DETECTED",
    type: "cycle",
    message: `${formatCycleMessage(graph, path)}. Soroban contracts cannot have cyclic control flow.`,
    nodeIds: path,
  }
}
