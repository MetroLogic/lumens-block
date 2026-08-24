/**
 * Function-group analysis for multi-function contract graphs.
 *
 * The original compiler assumed a single implicit root: it walked outward from
 * the Start node and emitted everything it found as one function body. A graph
 * can now instead declare several named entry points with `FunctionEntry`
 * blocks, each terminated by a `FunctionReturn`, and this module is what turns
 * those into independent, validated subgraphs.
 *
 * Both code generators (`compile/codegen` and `lib/compiler`) share it so the
 * editor's code preview and the WASM compile path can never disagree about what
 * a graph means.
 */

import {
  MAX_FUNCTION_PARAMS,
  RUST_IDENTIFIER_PATTERN,
  RUST_TYPE_PATTERN,
  type BlockType,
  type CompileError,
  type ContractGraph,
  type ContractGraphNode,
  type FunctionParamConfig,
  type FunctionVisibility,
} from "./schema"

/** Block types that emit statements into a function body. */
export const EXECUTABLE_TYPES = new Set<BlockType>([
  "Auth",
  "Transfer",
  "Storage",
  "Event",
  "Condition",
  "RBACCheck",
  "CrossContractCall",
])

/** One resolved function: its entry block, signature, and ordered body. */
export interface FunctionGroup {
  /** The FunctionEntry node this group was derived from. */
  entry: ContractGraphNode
  /** Validated Rust function name. */
  name: string
  visibility: FunctionVisibility
  /** Parameters declared on the entry block, in order, excluding `env`. */
  declaredParams: FunctionParamConfig[]
  /** Rust return type, `"()"` when the function returns nothing. */
  returnType: string
  /** Expression to return, or null when `returnType` is `"()"`. */
  returnValue: string | null
  /** Executable nodes in scoped execution order. */
  body: ContractGraphNode[]
  /** The FunctionReturn node terminating this subgraph. */
  returnNode: ContractGraphNode
}

function invalid(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

/** True when the graph declares at least one explicit function entry point. */
export function hasFunctionEntries(graph: ContractGraph): boolean {
  return graph.nodes.some((n) => n.type === "FunctionEntry")
}

function buildAdjacency(graph: ContractGraph): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }
  return adjacency
}

/**
 * Walks one function subgraph from `rootId`, stopping at FunctionReturn nodes.
 *
 * Returns every visited node id (the return nodes included) and the executable
 * nodes in breadth-first order, which is the same ordering the single-root
 * compiler has always used.
 */
export function traverseFunctionSubgraph(
  graph: ContractGraph,
  rootId: string,
  adjacency: Map<string, string[]> = buildAdjacency(graph)
): { visited: Set<string>; executable: ContractGraphNode[]; returnNodes: ContractGraphNode[] } {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const executable: ContractGraphNode[] = []
  const returnNodes: ContractGraphNode[] = []
  const queue = [rootId]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeById.get(id)
    if (!node) continue

    if (node.type === "FunctionReturn") {
      // A return terminates the branch: nothing downstream of it belongs to
      // this function.
      returnNodes.push(node)
      continue
    }

    if (EXECUTABLE_TYPES.has(node.type)) {
      executable.push(node)
    }

    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  return { visited, executable, returnNodes }
}

function validateSignature(entry: ContractGraphNode): CompileError | null {
  const params = entry.data.params ?? {}
  const name = (params.functionName ?? "").trim()

  if (name === "") {
    return invalid(
      "MISSING_FUNCTION_NAME",
      `FunctionEntry "${entry.id}" needs a function name.`
    )
  }

  if (!RUST_IDENTIFIER_PATTERN.test(name)) {
    return invalid(
      "INVALID_FUNCTION_NAME",
      `FunctionEntry "${entry.id}" has function name "${name}", which is not a valid Rust identifier.`,
      ["Names must match /^[a-z_][a-z0-9_]*$/, e.g. \"deposit\" or \"get_balance\"."]
    )
  }

  const declared = Array.isArray(params.functionParams) ? params.functionParams : []

  if (declared.length > MAX_FUNCTION_PARAMS) {
    return invalid(
      "TOO_MANY_FUNCTION_PARAMS",
      `Function "${name}" declares ${declared.length} parameters, above the maximum of ${MAX_FUNCTION_PARAMS}.`
    )
  }

  const seen = new Set<string>()
  for (const param of declared) {
    const paramName = (param?.name ?? "").trim()
    const rustType = (param?.rustType ?? "").trim()

    if (!RUST_IDENTIFIER_PATTERN.test(paramName)) {
      return invalid(
        "INVALID_PARAM_NAME",
        `Function "${name}" has parameter "${paramName}", which is not a valid Rust identifier.`
      )
    }

    if (paramName === "env") {
      return invalid(
        "RESERVED_PARAM_NAME",
        `Function "${name}" declares a parameter named "env", which codegen always supplies as the first argument.`
      )
    }

    if (seen.has(paramName)) {
      return invalid(
        "DUPLICATE_PARAM_NAME",
        `Function "${name}" declares parameter "${paramName}" more than once.`
      )
    }
    seen.add(paramName)

    const typeError = validateRustType(rustType, `parameter "${paramName}" of function "${name}"`)
    if (typeError) return typeError
  }

  return null
}

/**
 * Rejects type strings that could not plausibly be a Rust type.
 *
 * User-declared types are emitted verbatim, so this is the only thing standing
 * between the config panel and arbitrary text inside a function signature.
 */
export function validateRustType(rustType: string, subject: string): CompileError | null {
  const trimmed = rustType.trim()

  if (trimmed === "") {
    return invalid("INVALID_PARAM_TYPE", `Missing Rust type for ${subject}.`)
  }

  if (!RUST_TYPE_PATTERN.test(trimmed)) {
    return invalid(
      "INVALID_PARAM_TYPE",
      `Rust type "${trimmed}" for ${subject} contains characters that are not valid in a type.`
    )
  }

  if (!/^[A-Za-z_(&]/.test(trimmed)) {
    return invalid(
      "INVALID_PARAM_TYPE",
      `Rust type "${trimmed}" for ${subject} must start with a letter, "(" or "&".`
    )
  }

  const opens = (trimmed.match(/[<([]/g) ?? []).length
  const closes = (trimmed.match(/[>)\]]/g) ?? []).length
  if (opens !== closes) {
    return invalid(
      "INVALID_PARAM_TYPE",
      `Rust type "${trimmed}" for ${subject} has unbalanced brackets.`
    )
  }

  return null
}

/**
 * Returns a zero value for `rustType` so a function with no configured return
 * expression still produces a crate that compiles.
 */
export function defaultReturnValue(rustType: string): string {
  switch (rustType.trim()) {
    case "i32":
    case "i64":
    case "i128":
    case "u32":
    case "u64":
    case "u128":
      return "0"
    case "bool":
      return "false"
    case "Symbol":
      return 'symbol_short!("none")'
    default:
      return "Default::default()"
  }
}

/**
 * Resolves every FunctionEntry in the graph into a validated [`FunctionGroup`].
 *
 * Returns the first validation error it finds rather than a partial result, so
 * callers can surface one actionable message.
 */
export function collectFunctionGroups(
  graph: ContractGraph
): { ok: true; groups: FunctionGroup[] } | { ok: false; error: CompileError } {
  const entries = graph.nodes.filter((n) => n.type === "FunctionEntry")

  if (entries.length === 0) {
    return { ok: true, groups: [] }
  }

  const adjacency = buildAdjacency(graph)
  const groups: FunctionGroup[] = []
  const namesSeen = new Map<string, string>()
  /** node id → the function names that reached it, for shared-block detection. */
  const ownership = new Map<string, string[]>()

  for (const entry of entries) {
    const signatureError = validateSignature(entry)
    if (signatureError) return { ok: false, error: signatureError }

    const params = entry.data.params ?? {}
    const name = (params.functionName ?? "").trim()

    const previous = namesSeen.get(name)
    if (previous) {
      return {
        ok: false,
        error: invalid(
          "DUPLICATE_FUNCTION_NAME",
          `Two FunctionEntry blocks ("${previous}" and "${entry.id}") both declare the function name "${name}".`
        ),
      }
    }
    namesSeen.set(name, entry.id)

    const { visited, executable, returnNodes } = traverseFunctionSubgraph(
      graph,
      entry.id,
      adjacency
    )

    if (returnNodes.length === 0) {
      return {
        ok: false,
        error: invalid(
          "MISSING_FUNCTION_RETURN",
          `Function "${name}" has no FunctionReturn block reachable from its entry.`
        ),
      }
    }

    if (returnNodes.length > 1) {
      return {
        ok: false,
        error: invalid(
          "MULTIPLE_FUNCTION_RETURNS",
          `Function "${name}" reaches ${returnNodes.length} FunctionReturn blocks; a function must have exactly one.`
        ),
      }
    }

    const returnNode = returnNodes[0]
    const returnParams = returnNode.data.params ?? {}
    const returnType = (returnParams.returnType ?? "()").trim() || "()"

    if (returnType !== "()") {
      const returnTypeError = validateRustType(
        returnType,
        `the return type of function "${name}"`
      )
      if (returnTypeError) {
        return { ok: false, error: { ...returnTypeError, code: "INVALID_RETURN_TYPE" } }
      }
    }

    const configuredReturn = (returnParams.returnValue ?? "").trim()
    const returnValue =
      returnType === "()" ? null : configuredReturn || defaultReturnValue(returnType)

    for (const id of visited) {
      if (id === entry.id) continue
      const owners = ownership.get(id) ?? []
      owners.push(name)
      ownership.set(id, owners)
    }

    groups.push({
      entry,
      name,
      visibility: params.visibility === "pub(crate)" ? "pub(crate)" : "pub",
      declaredParams: (Array.isArray(params.functionParams) ? params.functionParams : []).map(
        (p) => ({ name: p.name.trim(), rustType: p.rustType.trim() })
      ),
      returnType,
      returnValue,
      body: executable,
      returnNode,
    })
  }

  // A block reached from two entries would be emitted into both function
  // bodies, which is never what the author meant.
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const [id, owners] of ownership) {
    if (owners.length < 2) continue
    const node = nodeById.get(id)
    const label = node ? `${node.type} "${node.data.label}"` : `Node "${id}"`
    return {
      ok: false,
      error: invalid(
        node?.type === "FunctionReturn" ? "SHARED_FUNCTION_RETURN" : "SHARED_FUNCTION_BLOCK",
        `${label} is reachable from more than one FunctionEntry (${owners.join(", ")}); each block must belong to exactly one function.`
      ),
    }
  }

  // A FunctionReturn nobody can reach is dead configuration, and usually a
  // half-wired graph.
  for (const node of graph.nodes) {
    if (node.type !== "FunctionReturn") continue
    if (!ownership.has(node.id)) {
      return {
        ok: false,
        error: invalid(
          "ORPHAN_FUNCTION_RETURN",
          `FunctionReturn "${node.data.label}" (${node.id}) is not reachable from any FunctionEntry.`
        ),
      }
    }
  }

  return { ok: true, groups }
}
