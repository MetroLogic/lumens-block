"use client"

import React from "react"
import { Shield } from "lucide-react"
import NodeShell from "./NodeShell"
import type { NodeData } from "./NodeShell"

interface AuthNodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

export default function AuthNode({ id, data, selected }: AuthNodeProps) {
  return (
    <NodeShell
      id={id}
      type="Auth"
      data={data}
      selected={selected}
      icon={Shield}
      badge="Auth"
      accentBg="bg-purple-50 dark:bg-purple-950/40"
      accentBorder="border-purple-300 dark:border-purple-700/60"
      accentText="text-purple-900 dark:text-purple-200"
      accentBadge="bg-purple-200/60 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
        Auth Method
      </p>
      <div className="rounded border border-purple-200 bg-white px-2 py-1 text-xs text-purple-900 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
        <code>Freighter Wallet</code>
      </div>
    </NodeShell>
  )
}