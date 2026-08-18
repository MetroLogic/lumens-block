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
  isCrossContractArgSource,
  isCrossContractType,
  CROSS_CONTRACT_TYPES,
  OPERATORS,
  type ConditionExpression,
  type CrossContractArg,
  type Operand,
} from "./schema"

function invalid(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

/**
 * Validates a ConditionExpression for operator correctness and non-empty operand values.
 * Returns a CompileError when invalid, or null when the expression is acceptable.
 */
function validateConditionExpression(nodeId: string, raw: unknown): CompileError | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return invalid(
      "INVALID_EXPRESSION",
      `Node "${nodeId}" has a malformed conditionExpression (must be an object).`
    )
  }

  const expr = raw as Record<string, unknown>

  // Validate operator
  if (!OPERATORS.includes(expr.operator as ConditionExpression["operator"])) {
    return invalid(
      "INVALID_EXPRESSION",
      `Node "${nodeId}" has an invalid condition operator "${String(expr.operator)}".`,
      [...OPERATORS]
    )
  }

  // Validate left operand value is non-empty
  const left = expr.left as Operand | undefined
  if (!left || typeof left.value !== "string" || left.value.trim() === "") {
    return invalid(
      "INCOMPLETE_EXPRESSION",
      `Node "${nodeId}" has an incomplete condition: left operand is empty.`
    )
  }

  // Validate right operand value is non-empty
  const right = expr.right as Operand | undefined
  if (!right || typeof right.value !== "string" || right.value.trim() === "") {
    return invalid(
      "INCOMPLETE_EXPRESSION",
      `Node "${nodeId}" has an incomplete condition: right operand is empty.`
    )
  }

  return null
}


/**
 * Validates the `targetArgs` list of a CrossContractCall node.
 * Returns a CompileError when malformed, or null when acceptable.
 */
function validateCrossContractArgs(nodeId: string, raw: unknown): CompileError | null {
  if (raw === undefined) return null

  if (!Array.isArray(raw)) {
    return invalid(
      "INVALID_ARGS",
      `Node "${nodeId}" has a malformed targetArgs (must be an array).`
    )
  }

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i]

    if (!isPlainObject(entry)) {
      return invalid("INVALID_ARGS", `Node "${nodeId}" argument ${i + 1} must be an object.`)
    }

    const arg = entry as unknown as CrossContractArg

    if (typeof arg.name !== "string" || arg.name.trim() === "") {
      return invalid("INVALID_ARGS", `Node "${nodeId}" argument ${i + 1} must have a name.`)
    }

    if (typeof arg.value !== "string") {
      return invalid(
        "INVALID_ARGS",
        `Node "${nodeId}" argument "${arg.name}" must have a string value.`
      )
    }

    if (!isCrossContractType(arg.rustType)) {
      return invalid(
        "INVALID_ARG_TYPE",
        `Node "${nodeId}" argument "${arg.name}" has unsupported Rust type "${String(arg.rustType)}".`,
        [...CROSS_CONTRACT_TYPES]
      )
    }

    if (arg.source !== undefined && !isCrossContractArgSource(arg.source)) {
      return invalid(
        "INVALID_ARGS",
        `Node "${nodeId}" argument "${arg.name}" has an unknown value source "${String(arg.source)}".`
      )
    }
  }

  return null
}

/**
 * Validates the configuration of a single CrossContractCall node.
 * Returns a CompileError when the block cannot be compiled, or null when it can.
 */
function validateCrossContractCall(node: ContractGraphNode): CompileError | null {
  const params = node.data.params ?? {}

  const targetContractId = typeof params.targetContractId === "string" ? params.targetContractId.trim() : ""
  if (targetContractId === "") {
    return invalid(
      "MISSING_TARGET_CONTRACT",
      `Cross-contract call "${node.data.label}" (node "${node.id}") is missing a target contract address.`
    )
  }

  const targetFunction = typeof params.targetFunction === "string" ? params.targetFunction.trim() : ""
  if (targetFunction === "") {
    return invalid(
      "MISSING_TARGET_FUNCTION",
      `Cross-contract call "${node.data.label}" (node "${node.id}") is missing a target function name.`
    )
  }

  const argsError = validateCrossContractArgs(node.id, params.targetArgs)
  if (argsError) return argsError

  const returnBinding = typeof params.returnBinding === "string" ? params.returnBinding.trim() : ""
  if (returnBinding !== "" && params.returnType !== undefined && !isCrossContractType(params.returnType)) {
    return invalid(
      "INVALID_RETURN_TYPE",
      `Cross-contract call "${node.data.label}" (node "${node.id}") has unsupported return type "${String(params.returnType)}".`,
      [...CROSS_CONTRACT_TYPES]
    )
  }

  return null
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseNode(raw: unknown, index: number): ContractGraphNode | CompileError {
  if (!isPlainObject(raw)) {
    return invalid("INVALID_NODE", `Node at index ${index} must be an object.`)
  }

  const { id, type, data, position } = raw

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

  // Validate structured conditionExpression when present on Condition nodes
  if (type === "Condition" && isPlainObject(params) && params.conditionExpression !== undefined) {
    const exprError = validateConditionExpression(id, params.conditionExpression)
    if (exprError) return exprError
  }

  // Validate the argument list of CrossContractCall nodes (shape only — required
  // fields are enforced by validateGraphStructure so in-progress editor graphs load).
  if (type === "CrossContractCall" && isPlainObject(params)) {
    const argsError = validateCrossContractArgs(id, params.targetArgs)
    if (argsError) return argsError
  }

  let parsedPosition: ContractGraphNode["position"]
  if (position !== undefined) {
    if (
      !isPlainObject(position) ||
      typeof position.x !== "number" ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return invalid(
        "INVALID_NODE",
        `Node "${id}" has invalid position (expected { x: number, y: number }).`
      )
    }
    parsedPosition = { x: position.x, y: position.y }
  }

  return {
    id,
    type,
    ...(parsedPosition ? { position: parsedPosition } : {}),
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

export interface ValidateContractGraphOptions {
  /**
   * When true, skip reachability / executable-block checks.
   * Useful for editor save/load of in-progress graphs.
   */
  skipStructureValidation?: boolean
}

/**
 * Validates raw JSON input and returns a normalized ContractGraph or a structured error.
 */
export function validateContractGraph(
  rawBody: unknown,
  byteLength?: number,
  options?: ValidateContractGraphOptions
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

  if (!options?.skipStructureValidation) {
    const structureError = validateGraphStructure(graph)
    if (structureError) {
      return { ok: false, error: structureError }
    }
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

  const executableTypes = new Set([
    "Condition",
    "Transfer",
    "Storage",
    "Event",
    "Auth",
    "CrossContractCall",
  ])
  const executableNodes = graph.nodes.filter(
    (n) => executableTypes.has(n.type) && reachable.has(n.id)
  )

  if (executableNodes.length === 0) {
    return invalid(
      "NO_EXECUTABLE_BLOCKS",
      "Graph must contain at least one executable block (Auth, Transfer, Storage, Event, Condition, or Cross-Contract Call) reachable from Start."
    )
  }

  // Cross-contract calls cannot be compiled without a target contract and function.
  for (const node of executableNodes) {
    if (node.type !== "CrossContractCall") continue
    const callError = validateCrossContractCall(node)
    if (callError) return callError
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
