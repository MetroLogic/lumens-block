/**
 * Connection validation rules for the LumensBlock editor.
 *
 * Defines which block types can connect to which, and enforces
 * maximum out-edge counts to prevent semantically invalid graphs.
 *
 * Rules are consumed by:
 *   - <ReactFlow isValidConnection={…}> for real-time visual feedback
 *   - Graph validation (issue #9) for compile-time checks
 */

import type { Node } from "reactflow"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockType = "default" | "Condition" | "Transfer" | "Storage" | "Event" | "Auth"

export const BLOCK_TYPES: BlockType[] = [
  "default",
  "Condition",
  "Transfer",
  "Storage",
  "Event",
  "Auth",
]

export function isBlockType(v: unknown): v is BlockType {
  return typeof v === "string" && (BLOCK_TYPES as string[]).includes(v)
}

export interface ConnectionRule {
  /** The source block type these rules apply to. */
  sourceType: BlockType
  /** Block types this source is allowed to connect TO. */
  validTargets: BlockType[]
  /** Maximum number of outgoing edges this source can have. */
  maxOutEdges: number
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const CONNECTION_RULES: ConnectionRule[] = [
  {
    sourceType: "default",
    validTargets: ["Condition", "Transfer", "Storage", "Event", "Auth"],
    maxOutEdges: 1,
  },
  {
    sourceType: "Condition",
    validTargets: ["Condition", "Transfer", "Storage", "Event", "Auth"],
    maxOutEdges: 2,
  },
  {
    sourceType: "Transfer",
    validTargets: ["Condition", "Transfer", "Storage", "Event", "Auth"],
    maxOutEdges: 1,
  },
  {
    sourceType: "Storage",
    validTargets: ["Condition", "Transfer", "Storage", "Event", "Auth"],
    maxOutEdges: 1,
  },
  {
    sourceType: "Event",
    validTargets: [],
    maxOutEdges: 0,
  },
  {
    sourceType: "Auth",
    validTargets: ["Transfer", "Storage", "Event"],
    maxOutEdges: 1,
  },
]

/** Look up the rule for a given block type string. */
export function getRule(sourceType: string): ConnectionRule | null {
  return CONNECTION_RULES.find((r) => r.sourceType === sourceType) ?? null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check whether a connection from `source` to `target` is valid
 * according to the block-type connection rules.
 *
 * @param source    Source node ID
 * @param target    Target node ID
 * @param nodes     All nodes currently on the canvas (needed for type lookup)
 * @param edges     All edges currently on the canvas (needed for out-edge count)
 * @returns         `{ valid: true }` or `{ valid: false, reason: string }`
 */
export function checkConnection(
  source: string,
  target: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): ValidationResult {
  const sourceNode = nodes.find((n) => n.id === source)
  const targetNode = nodes.find((n) => n.id === target)

  if (!sourceNode) {
    return { valid: false, reason: "Unknown source node." }
  }
  if (!targetNode) {
    return { valid: false, reason: "Unknown target node." }
  }

  // Self-connections are never valid
  if (source === target) {
    return { valid: false, reason: "A node cannot connect to itself." }
  }

  const sourceType = sourceNode.type ?? "default"
  const targetType = targetNode.type ?? "default"

  if (!isBlockType(sourceType)) {
    return { valid: false, reason: `Unknown block type: "${sourceType}".` }
  }

  const rule = getRule(sourceType)
  if (!rule) {
    return { valid: false, reason: `No connection rules for "${sourceType}" blocks.` }
  }

  // Check max out-edges
  const sourceOutEdgeCount = edges.filter((e) => e.source === source).length
  if (sourceOutEdgeCount >= rule.maxOutEdges) {
    return {
      valid: false,
      reason: `"${rule.sourceType}" blocks can have at most ${rule.maxOutEdges} outgoing connection${rule.maxOutEdges > 1 ? "s" : ""}.`,
    }
  }

  // Check valid target types
  if (!isBlockType(targetType)) {
    return { valid: false, reason: `Unknown block type: "${targetType}".` }
  }

  if (!rule.validTargets.includes(targetType)) {
    return {
      valid: false,
      reason: `"${rule.sourceType}" blocks cannot connect to "${targetType}" blocks.`,
    }
  }

  return { valid: true }
}
