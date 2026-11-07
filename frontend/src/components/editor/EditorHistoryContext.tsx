"use client"

import { createContext, useContext } from "react"
import type { BlockParameters } from "@/lib/compile/schema"

export interface EditorHistoryContextValue {
  updateNodeParams: (nodeId: string, patch: Partial<BlockParameters>) => void
}

export const EditorHistoryContext = createContext<EditorHistoryContextValue | null>(null)

export function useEditorHistoryContext() {
  return useContext(EditorHistoryContext)
}

