import type { Edge, Node } from "reactflow"

export type ValidationSeverity = "error" | "warning"

export interface ValidationIssue {
  code: string
  message: string
  severity: ValidationSeverity
  nodeId?: string
  edgeId?: string
  field?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  invalidNodeIds: Set<string>
  invalidEdgeIds: Set<string>
}

const REQUIRED_PARAM_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  Transfer: [
    { key: "token", label: "token address" },
    { key: "amount", label: "amount" },
  ],
  Storage: [{ key: "storageKey", label: "storage key" }],
  Event: [{ key: "eventName", label: "event name" }],
  Condition: [{ key: "condition", label: "condition expression" }],
}

const STELLAR_ADDRESS_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  Transfer: [{ key: "token", label: "token address" }],
}

const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/
const EXECUTABLE_BLOCK_TYPES = new Set(["Auth", "Transfer", "Storage", "Event", "Condition"])

function getNodeLabel(node: Node): string {
  const label = node.data?.label
  return typeof label === "string" && label.trim() ? label.trim() : node.id
}

function getParams(node: Node): Record<string, unknown> {
  const params = node.data?.params
  return typeof params === "object" && params !== null && !Array.isArray(params) ? params : {}
}

function isNonEmpty(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null
}

function addIssue(
  issues: ValidationIssue[],
  invalidNodeIds: Set<string>,
  issue: ValidationIssue
) {
  issues.push(issue)
  if (issue.nodeId) invalidNodeIds.add(issue.nodeId)
}

function findReachableNodeIds(startId: string, edges: Edge[]): Set<string> {
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const reachable = new Set<string>()
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)

    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) queue.push(next)
    }
  }

  return reachable
}

function findCycleNodeIds(nodes: Node[], edges: Edge[]): Set<string> {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycleNodes = new Set<string>()
  const path: string[] = []

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId)
      for (const id of path.slice(Math.max(cycleStart, 0))) {
        cycleNodes.add(id)
      }
      cycleNodes.add(nodeId)
      return
    }

    if (visited.has(nodeId)) return

    visiting.add(nodeId)
    path.push(nodeId)

    for (const next of adjacency.get(nodeId) ?? []) {
      visit(next)
    }

    path.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  for (const node of nodes) {
    visit(node.id)
  }

  return cycleNodes
}

export function validateGraph(graph: { nodes: Node[]; edges: Edge[] }): ValidationResult {
  const issues: ValidationIssue[] = []
  const invalidNodeIds = new Set<string>()
  const invalidEdgeIds = new Set<string>()
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const startNodes = graph.nodes.filter((node) => (node.type ?? "default") === "default")

  if (startNodes.length !== 1) {
    for (const node of startNodes) invalidNodeIds.add(node.id)
    issues.push({
      code: "START_NODE_COUNT",
      severity: "error",
      message:
        startNodes.length === 0
          ? "Graph must include one Start node before deployment."
          : "Graph must include only one Start node before deployment.",
    })
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      invalidEdgeIds.add(edge.id)
      issues.push({
        code: "BROKEN_EDGE",
        severity: "error",
        edgeId: edge.id,
        message: `Edge ${edge.id} references a missing ${!nodeIds.has(edge.source) ? "source" : "target"} node.`,
      })
    }
  }

  if (startNodes.length === 1) {
    const reachable = findReachableNodeIds(startNodes[0].id, graph.edges)
    let reachableExecutableCount = 0

    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        addIssue(issues, invalidNodeIds, {
          code: "UNREACHABLE_NODE",
          severity: "error",
          nodeId: node.id,
          message: `${getNodeLabel(node)} is disconnected from Start.`,
        })
      } else if (EXECUTABLE_BLOCK_TYPES.has(node.type ?? "default")) {
        reachableExecutableCount += 1
      }
    }

    if (reachableExecutableCount === 0) {
      issues.push({
        code: "NO_EXECUTABLE_BLOCKS",
        severity: "error",
        message: "Graph must include at least one executable block reachable from Start.",
      })
    }
  }

  for (const node of graph.nodes) {
    const type = node.type ?? "default"
    const params = getParams(node)

    for (const field of REQUIRED_PARAM_FIELDS[type] ?? []) {
      if (!isNonEmpty(params[field.key])) {
        addIssue(issues, invalidNodeIds, {
          code: "MISSING_REQUIRED_FIELD",
          severity: "error",
          nodeId: node.id,
          field: field.key,
          message: `${getNodeLabel(node)} is missing a required ${field.label}.`,
        })
      }
    }

    for (const field of STELLAR_ADDRESS_FIELDS[type] ?? []) {
      const value = params[field.key]
      if (isNonEmpty(value) && (typeof value !== "string" || !STELLAR_PUBLIC_KEY_PATTERN.test(value.trim()))) {
        addIssue(issues, invalidNodeIds, {
          code: "INVALID_STELLAR_ADDRESS",
          severity: "error",
          nodeId: node.id,
          field: field.key,
          message: `${getNodeLabel(node)} has an invalid Stellar ${field.label}; expected a 56-character G... public key.`,
        })
      }
    }
  }

  const cycleNodeIds = findCycleNodeIds(graph.nodes, graph.edges)
  for (const nodeId of cycleNodeIds) {
    const node = graph.nodes.find((item) => item.id === nodeId)
    addIssue(issues, invalidNodeIds, {
      code: "CYCLE_DETECTED",
      severity: "error",
      nodeId,
      message: `${node ? getNodeLabel(node) : nodeId} participates in a cycle that could loop forever.`,
    })
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    invalidNodeIds,
    invalidEdgeIds,
  }
}
