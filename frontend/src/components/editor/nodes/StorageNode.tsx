"use client"

import React from "react"
import { Database } from "lucide-react"
import NodeShell from "./NodeShell"
import type { NodeData } from "./NodeShell"

interface StorageNodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

export default function StorageNode({ id, data, selected }: StorageNodeProps) {
  return (
    <NodeShell
      id={id}
      type="Storage"
      data={data}
      selected={selected}
      icon={Database}
      badge="Storage"
      accentBg="bg-amber-50 dark:bg-amber-950/40"
      accentBorder="border-amber-300 dark:border-amber-700/60"
      accentText="text-amber-900 dark:text-amber-200"
      accentBadge="bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Storage Key
      </p>
      <div className="rounded border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <code>{data.params?.storageKey ?? "—"}</code>
      </div>
    </NodeShell>
  )
}