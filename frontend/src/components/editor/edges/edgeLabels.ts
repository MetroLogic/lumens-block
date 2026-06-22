export interface EdgeLabelData {
  label?: string
}

const HANDLE_LABELS: Record<string, string> = {
  "condition-true": "true",
  "condition-false": "false",
  "transfer-success": "success",
  "transfer-failure": "failure",
}

export function getDefaultEdgeLabel(sourceHandle?: string | null): string {
  return sourceHandle ? HANDLE_LABELS[sourceHandle] ?? "" : ""
}

export function normalizeEdgeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized.length > 0 ? normalized.slice(0, 32) : undefined
}
