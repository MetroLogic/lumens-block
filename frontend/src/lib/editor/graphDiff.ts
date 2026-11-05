import type { ContractGraph, ContractGraphEdge, ContractGraphNode } from "@/lib/compile/schema"
import {
  getExecutionOrder,
  getFunctionParamsFromGraph,
  type FunctionParam,
} from "@/lib/compile/codegen"

/**
 * A single field-level change on a node that exists in both graphs.
 * `changedFields` uses dotted paths, e.g. `"data.label"`, `"params.storageKey"`.
 */
export interface NodeModification {
  node: ContractGraphNode
  changedFields: string[]
}

/**
 * A change that will alter the deployed contract's on-chain interface or
 * behaviour, breaking existing integrations.
 */
export interface BreakingChange {
  kind:
    | "param_removed"
    | "param_type_changed"
    | "storage_key_renamed"
    | "node_removed"
    | "execution_order_changed"
  description: string
  nodeId?: string
}

/** Full result of comparing the last-deployed snapshot against the canvas. */
export interface GraphDiff {
  addedNodes: ContractGraphNode[]
  removedNodes: ContractGraphNode[]
  modifiedNodes: NodeModification[]
  addedEdges: ContractGraphEdge[]
  removedEdges: ContractGraphEdge[]
  breakingChanges: BreakingChange[]
  hasBreakingChanges: boolean
}

/** Block types that produce contract behaviour (everything except the Start node). */
const EXECUTABLE_BLOCK_TYPES = new Set([
  "Auth", "RBACCheck", "Transfer", "Storage", "Event", "Condition", "Loop"
])

/** Storage key default used by codegen when a Storage block omits `storageKey`. */
const DEFAULT_STORAGE_KEY = "stored"

/**
 * Types whose topological sequence is sensitive to ordering changes.
 * Moving an Auth/RBAC/Transfer node relative to others produces a different diff status.
 */
const ORDER_SENSITIVE_TYPES = new Set(["Auth", "RBACCheck", "Transfer"])

function diffNodeFields(prev: ContractGraphNode, next: ContractGraphNode): string[] {
  const changed: string[] = []

  if (prev.type !== next.type) changed.push("type")
  if (prev.data.label !== next.data.label) changed.push("data.label")

  const prevParams = (prev.data.params ?? {}) as Record<string, unknown>
  const nextParams = (next.data.params ?? {}) as Record<string, unknown>
  const paramKeys = new Set([...Object.keys(prevParams), ...Object.keys(nextParams)])
  for (const key of paramKeys) {
    if (JSON.stringify(prevParams[key]) !== JSON.stringify(nextParams[key])) {
      changed.push(`params.${key}`)
    }
  }

  return changed
}

/** Detect removed params and params whose Rust type changed. */
function diffParams(prevParams: FunctionParam[], nextParams: FunctionParam[]): BreakingChange[] {
  const changes: BreakingChange[] = []
  const nextByName = new Map(nextParams.map((param) => [param.name, param]))

  for (const prevParam of prevParams) {
    const nextParam = nextByName.get(prevParam.name)
    if (!nextParam) {
      changes.push({
        kind: "param_removed",
        description: `Function parameter "${prevParam.name}" (${prevParam.rustType}) was removed from the contract interface.`,
      })
    } else if (nextParam.rustType !== prevParam.rustType) {
      changes.push({
        kind: "param_type_changed",
        description: `Function parameter "${prevParam.name}" changed type from ${prevParam.rustType} to ${nextParam.rustType}.`,
      })
    }
  }

  return changes
}

/**
 * Returns the ids of Auth/Transfer blocks in topological execution order.
 * Only these block types are order-sensitive per the breaking-change rules.
 */
function orderSensitiveSequence(graph: ContractGraph): string[] {
  return getExecutionOrder(graph)
    .filter((node) => ORDER_SENSITIVE_TYPES.has(node.type))
    .map((node) => node.id)
}

/** Detect when the relative execution order of Auth/Transfer blocks changed. */
function diffExecutionOrder(prev: ContractGraph, next: ContractGraph): BreakingChange[] {
  const prevOrder = orderSensitiveSequence(prev)
  const nextOrder = orderSensitiveSequence(next)

  // Compare only blocks present in both graphs so that adding/removing a block
  // does not itself masquerade as a reorder (those are reported separately).
  const common = prevOrder.filter((id) => nextOrder.includes(id))
  if (common.length === 0) return []

  const prevSeq = prevOrder.filter((id) => common.includes(id)).join("→")
  const nextSeq = nextOrder.filter((id) => common.includes(id)).join("→")
  if (prevSeq === nextSeq) return []

  const labelOf = new Map(
    [...prev.nodes, ...next.nodes].map((node) => [node.id, node.data.label])
  )
  const describe = (seq: string) =>
    seq
      .split("→")
      .map((id) => labelOf.get(id) ?? id)
      .join(" → ")

  return [
    {
      kind: "execution_order_changed",
      description: `Execution order of Auth/Transfer blocks changed from [${describe(prevSeq)}] to [${describe(nextSeq)}].`,
    },
  ]
}

/**
 * Compares the last-deployed graph snapshot against the current canvas graph
 * and classifies every change as breaking or non-breaking.
 *
 * Passing `null` as `prev` (nothing deployed yet) yields an empty diff so the
 * first deployment never triggers the breaking-change flow.
 */
export function diffGraphs(prev: ContractGraph | null, next: ContractGraph): GraphDiff {
  const diff: GraphDiff = {
    addedNodes: [],
    removedNodes: [],
    modifiedNodes: [],
    addedEdges: [],
    removedEdges: [],
    breakingChanges: [],
    hasBreakingChanges: false,
  }

  if (!prev) return diff

  const prevNodeById = new Map(prev.nodes.map((node) => [node.id, node]))
  const nextNodeById = new Map(next.nodes.map((node) => [node.id, node]))

  // ── Nodes ──────────────────────────────────────────────────────────────────
  for (const node of next.nodes) {
    if (!prevNodeById.has(node.id)) diff.addedNodes.push(node)
  }

  for (const prevNode of prev.nodes) {
    if (!nextNodeById.has(prevNode.id)) {
      diff.removedNodes.push(prevNode)
      if (EXECUTABLE_BLOCK_TYPES.has(prevNode.type)) {
        diff.breakingChanges.push({
          kind: "node_removed",
          description: `Block "${prevNode.data.label}" (${prevNode.type}) was removed from the graph.`,
          nodeId: prevNode.id,
        })
      }
    }
  }

  // ── Modified nodes + storage key renames ───────────────────────────────────
  for (const prevNode of prev.nodes) {
    const nextNode = nextNodeById.get(prevNode.id)
    if (!nextNode) continue

    const changedFields = diffNodeFields(prevNode, nextNode)
    if (changedFields.length > 0) {
      diff.modifiedNodes.push({ node: nextNode, changedFields })
    }

    if (prevNode.type === "Storage") {
      const prevKey = prevNode.data.params?.storageKey ?? DEFAULT_STORAGE_KEY
      const nextKey = nextNode.data.params?.storageKey ?? DEFAULT_STORAGE_KEY
      if (prevKey !== nextKey) {
        diff.breakingChanges.push({
          kind: "storage_key_renamed",
          description: `Storage key "${prevKey}" was renamed to "${nextKey}" on block "${nextNode.data.label}".`,
          nodeId: prevNode.id,
        })
      }
    }
  }

  // ── Edges ──────────────────────────────────────────────────────────────────
  const edgeKey = (edge: ContractGraphEdge) => `${edge.source}->${edge.target}`
  const prevEdgeKeys = new Set(prev.edges.map(edgeKey))
  const nextEdgeKeys = new Set(next.edges.map(edgeKey))

  for (const edge of next.edges) {
    if (!prevEdgeKeys.has(edgeKey(edge))) diff.addedEdges.push(edge)
  }
  for (const edge of prev.edges) {
    if (!nextEdgeKeys.has(edgeKey(edge))) diff.removedEdges.push(edge)
  }

  // ── Contract interface (derived params) ────────────────────────────────────
  diff.breakingChanges.push(
    ...diffParams(getFunctionParamsFromGraph(prev), getFunctionParamsFromGraph(next))
  )

  // ── Execution order ────────────────────────────────────────────────────────
  diff.breakingChanges.push(...diffExecutionOrder(prev, next))

  diff.hasBreakingChanges = diff.breakingChanges.length > 0
  return diff
}
