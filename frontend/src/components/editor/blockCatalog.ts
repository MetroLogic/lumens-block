import type { BlockType } from "@/lib/compile/schema"

export type EditorBlockType = Exclude<BlockType, "default">

export interface BlockCatalogItem {
  type: EditorBlockType
  name: string
  description: string
  keywords: string[]
}

export const BLOCK_CATALOG: BlockCatalogItem[] = [
  {
    type: "Condition",
    name: "Condition",
    description: "Branch contract logic from a boolean expression.",
    keywords: ["if", "branch", "guard", "expression", "check"],
  },
  {
    type: "Transfer",
    name: "Transfer",
    description: "Move tokens between Stellar accounts or contract addresses.",
    keywords: ["pay", "send", "token", "asset", "xlm", "xfer"],
  },
  {
    type: "Storage",
    name: "Storage",
    description: "Read or write persistent contract state values.",
    keywords: ["state", "save", "key", "value", "persist"],
  },
  {
    type: "Event",
    name: "Event",
    description: "Emit an on-chain event for indexers and observers.",
    keywords: ["log", "emit", "notify", "topic"],
  },
  {
    type: "Auth",
    name: "Auth",
    description: "Require a caller signature before continuing execution.",
    keywords: ["sign", "signature", "permission", "access", "authorize"],
  },
]

export function isEditorBlockType(value: string): value is EditorBlockType {
  return BLOCK_CATALOG.some((item) => item.type === value)
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function isSubsequence(needle: string, haystack: string) {
  if (needle.length === 0) return true

  let haystackIndex = 0
  for (const char of needle) {
    haystackIndex = haystack.indexOf(char, haystackIndex)
    if (haystackIndex === -1) return false
    haystackIndex += 1
  }

  return true
}

function scoreBlock(item: BlockCatalogItem, query: string) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return 1

  const terms = normalizedQuery.split(/\s+/)
  const name = normalize(item.name)
  const description = normalize(item.description)
  const normalizedKeywords = item.keywords.map(normalize)
  const keywords = normalizedKeywords.join(" ")
  const searchable = `${name} ${description} ${keywords}`

  if (name === normalizedQuery) return 100
  if (name.startsWith(normalizedQuery)) return 90
  if (normalizedKeywords.some((keyword) => keyword === normalizedQuery)) return 85
  if (normalizedKeywords.some((keyword) => keyword.startsWith(normalizedQuery))) return 75
  if (terms.every((term) => searchable.includes(term))) return 70
  if (
    isSubsequence(normalizedQuery.replace(/\s+/g, ""), name.replace(/\s+/g, "")) ||
    normalizedKeywords.some((keyword) => isSubsequence(normalizedQuery.replace(/\s+/g, ""), keyword.replace(/\s+/g, "")))
  ) {
    return 60
  }
  if (isSubsequence(normalizedQuery.replace(/\s+/g, ""), searchable.replace(/\s+/g, ""))) return 40

  return 0
}

export function filterBlockCatalog(query: string) {
  return BLOCK_CATALOG.map((item, index) => ({
    item,
    index,
    score: scoreBlock(item, query),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}
