"use client"

import React from "react"
import { Bell } from "lucide-react"
import NodeShell from "./NodeShell"
import type { NodeData } from "./NodeShell"

interface EventNodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

export default function EventNode({ id, data, selected }: EventNodeProps) {
  return (
    <NodeShell
      id={id}
      type="Event"
      data={data}
      selected={selected}
      icon={Bell}
      badge="Event"
      accentBg="bg-sky-50 dark:bg-sky-950/40"
      accentBorder="border-sky-300 dark:border-sky-700/60"
      accentText="text-sky-900 dark:text-sky-200"
      accentBadge="bg-sky-200/60 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        Event Name
      </p>
      <div className="rounded border border-sky-200 bg-white px-2 py-1 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
        <code>{data.params?.eventName ?? "—"}</code>
      </div>
    </NodeShell>
  )
}