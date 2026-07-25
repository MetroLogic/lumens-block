import type { Edge, Node } from "reactflow"

export type ValidationSeverity = "error"

export interface ValidationIssue {
  code: string
  message: string
  nodeId?: string
  severity: ValidationSeverity
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  issuesByNodeId: Record<string, ValidationIssue[]>
}

const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/
const REQUIRED_PARAMS: Record<string, string[]> = {
  Transfer: ["amount"],
  Storage: ["storageKey"],
  Event: ["eventName"],
}

function addIssue(issues: ValidationIssue[], issue: Omit<ValidationIssue, "severity">) {
  issues.push({ ...issue, severity: "error" })
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "")
}

function collectReachable(startId: string, edges: Edge[]): Set<string> {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  }

  const reachable = new Set<string>()
  const queue = [startId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const target of adjacency.get(current) ?? []) {
      if (!reachable.has(target)) queue.push(target)
    }
  }
  return reachable
}

function findCycle(nodes: Node[], edges: Edge[]): string[] | null {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  const visit = (nodeId: string): string[] | null => {
    if (visiting.has(nodeId)) {
      return stack.slice(stack.indexOf(nodeId)).concat(nodeId)
    }
    if (visited.has(nodeId)) return null

    visiting.add(nodeId)
    stack.push(nodeId)
    for (const target of adjacency.get(nodeId) ?? []) {
      const cycle = visit(target)
      if (cycle) return cycle
    }
    stack.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
    return null
  }

  for (const node of nodes) {
    const cycle = visit(node.id)
    if (cycle) return cycle
  }
  return null
}

function inspectAddressFields(node: Node, issues: ValidationIssue[]) {
  const params = (node.data?.params ?? {}) as Record<string, unknown>
  for (const [key, value] of Object.entries(params)) {
    const keyLooksLikeAddress = /address|account|recipient|receiver|destination|signer/i.test(key)
    if (!keyLooksLikeAddress || isMissing(value)) continue
    if (typeof value !== "string" || !STELLAR_ACCOUNT_RE.test(value.trim())) {
      addIssue(issues, {
        code: "INVALID_STELLAR_ADDRESS",
        nodeId: node.id,
        message: `${node.data?.label ?? node.id}: ${key} must be a 56-character Stellar G... account address.`,
      })
    }
  }
}

export function validateGraph(graph: { nodes: Node[]; edges: Edge[] }): ValidationResult {
  const issues: ValidationIssue[] = []
  const nodes = graph.nodes
  const edges = graph.edges

  const startNodes = nodes.filter((node) => (node.type ?? "default") === "default")
  if (startNodes.length !== 1) {
    addIssue(issues, {
      code: "START_NODE_REQUIRED",
      message: "Graph must contain exactly one Start node.",
      nodeId: startNodes[0]?.id,
    })
  }

  const start = startNodes[0]
  if (start) {
    const reachable = collectReachable(start.id, edges)
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        addIssue(issues, {
          code: "UNREACHABLE_NODE",
          nodeId: node.id,
          message: `${node.data?.label ?? node.id} is not reachable from Start.`,
        })
      }
    }
  }

  const cycle = findCycle(nodes, edges)
  if (cycle) {
    addIssue(issues, {
      code: "GRAPH_CYCLE",
      nodeId: cycle[0],
      message: `Graph contains a cycle: ${cycle.join(" -> ")}.`,
    })
  }

  for (const node of nodes) {
    const type = node.type ?? "default"
    const params = (node.data?.params ?? {}) as Record<string, unknown>
    for (const field of REQUIRED_PARAMS[type] ?? []) {
      if (isMissing(params[field])) {
        addIssue(issues, {
          code: "MISSING_REQUIRED_FIELD",
          nodeId: node.id,
          message: `${node.data?.label ?? node.id} is missing required field "${field}".`,
        })
      }
    }
    inspectAddressFields(node, issues)
  }

  const issuesByNodeId: Record<string, ValidationIssue[]> = {}
  for (const issue of issues) {
    if (!issue.nodeId) continue
    issuesByNodeId[issue.nodeId] = [...(issuesByNodeId[issue.nodeId] ?? []), issue]
  }

  return {
    valid: issues.length === 0,
    issues,
    issuesByNodeId,
  }
}