import {
  BLOCK_TYPES,
  ContractGraph,
  ContractGraphEdge,
  ContractGraphNode,
  CompileError,
  MAX_EDGES,
  MAX_GRAPH_BYTES,
  MAX_NODES,
  isBlockType,
} from "./schema"

function invalid(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseNode(raw: unknown, index: number): ContractGraphNode | CompileError {
  if (!isPlainObject(raw)) {
    return invalid("INVALID_NODE", `Node at index ${index} must be an object.`)
  }

  const { id, type, data } = raw

  if (typeof id !== "string" || id.trim() === "") {
    return invalid("INVALID_NODE", `Node at index ${index} must have a non-empty string id.`)
  }

  if (!isBlockType(type)) {
    return invalid(
      "INVALID_BLOCK_TYPE",
      `Node "${id}" has unknown type "${String(type)}".`,
      [...BLOCK_TYPES]
    )
  }

  if (!isPlainObject(data)) {
    return invalid("INVALID_NODE", `Node "${id}" must have a data object.`)
  }

  if (typeof data.label !== "string") {
    return invalid("INVALID_NODE", `Node "${id}" must have data.label as a string.`)
  }

  const params = data.params
  if (params !== undefined && !isPlainObject(params)) {
    return invalid("INVALID_NODE", `Node "${id}" has invalid data.params.`)
  }

  return {
    id,
    type,
    data: {
      label: data.label,
      ...(params !== undefined ? { params: params as ContractGraphNode["data"]["params"] } : {}),
    },
  }
}

function parseEdge(raw: unknown, index: number): ContractGraphEdge | CompileError {
  if (!isPlainObject(raw)) {
    return invalid("INVALID_EDGE", `Edge at index ${index} must be an object.`)
  }

  const { id, source, target } = raw

  if (typeof id !== "string" || id.trim() === "") {
    return invalid("INVALID_EDGE", `Edge at index ${index} must have a non-empty string id.`)
  }

  if (typeof source !== "string" || source.trim() === "") {
    return invalid("INVALID_EDGE", `Edge "${id}" must have a non-empty source.`)
  }

  if (typeof target !== "string" || target.trim() === "") {
    return invalid("INVALID_EDGE", `Edge "${id}" must have a non-empty target.`)
  }

  return {
    id,
    source,
    target,
    sourceHandle: typeof raw.sourceHandle === "string" ? raw.sourceHandle : null,
    targetHandle: typeof raw.targetHandle === "string" ? raw.targetHandle : null,
  }
}

/**
 * Validates raw JSON input and returns a normalized ContractGraph or a structured error.
 */
export function validateContractGraph(
  rawBody: unknown,
  byteLength?: number
): { ok: true; graph: ContractGraph } | { ok: false; error: CompileError } {
  if (byteLength !== undefined && byteLength > MAX_GRAPH_BYTES) {
    return {
      ok: false,
      error: invalid(
        "PAYLOAD_TOO_LARGE",
        `Graph payload exceeds ${MAX_GRAPH_BYTES} bytes (${byteLength} bytes received).`
      ),
    }
  }

  if (!isPlainObject(rawBody)) {
    return {
      ok: false,
      error: invalid("INVALID_PAYLOAD", "Request body must be a JSON object with nodes and edges."),
    }
  }

  const { nodes, edges } = rawBody

  if (!Array.isArray(nodes)) {
    return {
      ok: false,
      error: invalid("INVALID_PAYLOAD", "Graph must include a nodes array."),
    }
  }

  if (!Array.isArray(edges)) {
    return {
      ok: false,
      error: invalid("INVALID_PAYLOAD", "Graph must include an edges array."),
    }
  }

  if (nodes.length === 0) {
    return {
      ok: false,
      error: invalid("EMPTY_GRAPH", "Graph must contain at least one node."),
    }
  }

  if (nodes.length > MAX_NODES) {
    return {
      ok: false,
      error: invalid(
        "TOO_MANY_NODES",
        `Graph exceeds the maximum of ${MAX_NODES} nodes (${nodes.length} provided).`
      ),
    }
  }

  if (edges.length > MAX_EDGES) {
    return {
      ok: false,
      error: invalid(
        "TOO_MANY_EDGES",
        `Graph exceeds the maximum of ${MAX_EDGES} edges (${edges.length} provided).`
      ),
    }
  }

  const parsedNodes: ContractGraphNode[] = []
  const nodeIds = new Set<string>()

  for (let i = 0; i < nodes.length; i++) {
    const result = parseNode(nodes[i], i)
    if ("code" in result) {
      return { ok: false, error: result }
    }

    if (nodeIds.has(result.id)) {
      return {
        ok: false,
        error: invalid("DUPLICATE_NODE_ID", `Duplicate node id "${result.id}".`),
      }
    }

    nodeIds.add(result.id)
    parsedNodes.push(result)
  }

  const parsedEdges: ContractGraphEdge[] = []

  for (let i = 0; i < edges.length; i++) {
    const result = parseEdge(edges[i], i)
    if ("code" in result) {
      return { ok: false, error: result }
    }

    if (!nodeIds.has(result.source)) {
      return {
        ok: false,
        error: invalid(
          "INVALID_EDGE",
          `Edge "${result.id}" references unknown source node "${result.source}".`
        ),
      }
    }

    if (!nodeIds.has(result.target)) {
      return {
        ok: false,
        error: invalid(
          "INVALID_EDGE",
          `Edge "${result.id}" references unknown target node "${result.target}".`
        ),
      }
    }

    parsedEdges.push(result)
  }

  const startNodes = parsedNodes.filter((n) => n.type === "default")
  if (startNodes.length === 0) {
    return {
      ok: false,
      error: invalid(
        "MISSING_START_NODE",
        'Graph must include exactly one Start node (type "default").'
      ),
    }
  }

  if (startNodes.length > 1) {
    return {
      ok: false,
      error: invalid(
        "MULTIPLE_START_NODES",
        "Graph must contain exactly one Start node."
      ),
    }
  }

  const graph: ContractGraph = { nodes: parsedNodes, edges: parsedEdges }

  const structureError = validateGraphStructure(graph)
  if (structureError) {
    return { ok: false, error: structureError }
  }

  return { ok: true, graph }
}

/**
 * Ensures executable blocks are reachable from Start and the graph has actionable logic.
 */
export function validateGraphStructure(graph: ContractGraph): CompileError | null {
  const start = graph.nodes.find((n) => n.type === "default")
  if (!start) {
    return invalid("MISSING_START_NODE", 'Graph must include a Start node (type "default").')
  }

  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  const reachable = new Set<string>()
  const queue = [start.id]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) queue.push(next)
    }
  }

  const executableTypes = new Set(["Condition", "Transfer", "Storage", "Event", "Auth"])
  const executableNodes = graph.nodes.filter(
    (n) => executableTypes.has(n.type) && reachable.has(n.id)
  )

  if (executableNodes.length === 0) {
    return invalid(
      "NO_EXECUTABLE_BLOCKS",
      "Graph must contain at least one executable block (Auth, Transfer, Storage, Event, or Condition) reachable from Start."
    )
  }

  return null
}

/**
 * Converts a React Flow graph (with optional extra fields) into the compile schema.
 */
export function normalizeReactFlowGraph(input: {
  nodes: Array<{
    id: string
    type?: string
    position?: { x: number; y: number }
    data?: { label?: string; params?: unknown }
  }>
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>
}): ContractGraph {
  return {
    nodes: input.nodes.map((node) => ({
      id: node.id,
      type: (node.type ?? "default") as ContractGraphNode["type"],
      ...(node.position ? { position: node.position } : {}),
      data: {
        label: node.data?.label ?? node.type ?? "Block",
        ...(node.data?.params ? { params: node.data.params as ContractGraphNode["data"]["params"] } : {}),
      },
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  }
}
