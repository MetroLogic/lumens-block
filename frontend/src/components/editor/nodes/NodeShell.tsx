"use client"

import React from "react"
import { Handle, Position } from "reactflow"
import type { LucideIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Shared shell for custom block nodes. Each block type provides its own icon,
// accent colour classes and an optional selected-state config panel.
// ---------------------------------------------------------------------------

export interface NodeData {
  label: string
  params?: {
    condition?: string
    conditionExpression?: unknown
    storageKey?: string
    token?: string
    asset?: unknown
    eventName?: string
  }
}

interface NodeShellProps {
  id: string
  type: string
  data: NodeData
  selected?: boolean
  icon: LucideIcon
  badge: string
  accentBg: string
  accentBorder: string
  accentText: string
  accentBadge: string
  children?: React.ReactNode
}

export default function NodeShell({
  type,
  data,
  selected,
  icon: Icon,
  badge,
  accentBg,
  accentBorder,
  accentText,
  accentBadge,
  children,
}: NodeShellProps) {
  return (
    <div
      data-testid={`block-node-${type}`}
      className={`relative rounded-xl border-2 shadow-sm font-sans min-w-[180px] ${accentBg} ${accentBorder} ${accentText} ${
        selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
      }`}
    >
      {/* Target handle on top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />

      {/* Node header */}
      <div className="flex flex-col items-center gap-1 px-4 py-3 text-center">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${accentBadge}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {badge}
        </span>
        <div className="text-sm font-semibold mt-1">{data.label}</div>
      </div>

      {/* Config panel — only visible when node is selected */}
      {children && selected && (
        <div
          data-testid="config-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 ${accentBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}

      {/* Source handle on bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />
    </div>
  )
}