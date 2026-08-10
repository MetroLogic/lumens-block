"use client"

import { createContext, useContext } from "react"

export interface EdgeLabelContextValue {
  /** The edge id currently being edited, or null. */
  editingEdgeId: string | null
  /** Begin inline editing of an edge label. */
  beginEdit: (edgeId: string) => void
  /** Commit a label value to an edge. */
  commitLabel: (edgeId: string, label: string) => void
  /** Cancel inline editing without saving. */
  cancelEdit: () => void
}

export const EdgeLabelContext = createContext<EdgeLabelContextValue>({
  editingEdgeId: null,
  beginEdit: () => {},
  commitLabel: () => {},
  cancelEdit: () => {},
})

export function useEdgeLabelContext() {
  return useContext(EdgeLabelContext)
}