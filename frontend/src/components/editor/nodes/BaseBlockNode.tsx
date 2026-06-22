"use client"

import {
  BadgeCheck,
  Binary,
  Database,
  KeyRound,
  Send,
  type LucideIcon,
} from "lucide-react"
import { Handle, Position, type NodeProps } from "reactflow"

export interface BlockNodeData {
  label: string
  params?: Record<string, string | undefined>
}

export interface BlockTheme {
  type: string
  icon: LucideIcon
  headerClassName: string
  borderClassName: string
  badgeClassName: string
  description: string
  fields: Array<{ key: string; label: string; fallback: string }>
}

export const blockNodeThemes: Record<string, BlockTheme> = {
  Auth: {
    type: "Auth",
    icon: KeyRound,
    headerClassName: "bg-violet-700 text-white",
    borderClassName: "border-violet-300 shadow-violet-100",
    badgeClassName: "bg-violet-100 text-violet-800",
    description: "Requires caller authorization",
    fields: [],
  },
  Condition: {
    type: "Condition",
    icon: Binary,
    headerClassName: "bg-rose-700 text-white",
    borderClassName: "border-rose-300 shadow-rose-100",
    badgeClassName: "bg-rose-100 text-rose-800",
    description: "Branches on a guard expression",
    fields: [{ key: "condition", label: "Expression", fallback: "release == true" }],
  },
  Transfer: {
    type: "Transfer",
    icon: Send,
    headerClassName: "bg-emerald-700 text-white",
    borderClassName: "border-emerald-300 shadow-emerald-100",
    badgeClassName: "bg-emerald-100 text-emerald-800",
    description: "Moves tokens between addresses",
    fields: [{ key: "token", label: "Token", fallback: "XLM / SAC token" }],
  },
  Storage: {
    type: "Storage",
    icon: Database,
    headerClassName: "bg-amber-600 text-white",
    borderClassName: "border-amber-300 shadow-amber-100",
    badgeClassName: "bg-amber-100 text-amber-800",
    description: "Writes contract storage",
    fields: [{ key: "storageKey", label: "Key", fallback: "instance key" }],
  },
  Event: {
    type: "Event",
    icon: BadgeCheck,
    headerClassName: "bg-sky-700 text-white",
    borderClassName: "border-sky-300 shadow-sky-100",
    badgeClassName: "bg-sky-100 text-sky-800",
    description: "Publishes an indexable event",
    fields: [{ key: "eventName", label: "Event", fallback: "event name" }],
  },
}

interface Props extends NodeProps<BlockNodeData> {
  blockType: keyof typeof blockNodeThemes
}

export default function BaseBlockNode({ data, selected, blockType }: Props) {
  const theme = blockNodeThemes[blockType]
  const Icon = theme.icon

  return (
    <article
      aria-label={`${theme.type} block: ${data.label}`}
      className={`relative min-w-[180px] overflow-hidden rounded-lg border-2 bg-white font-sans text-slate-900 shadow-sm ${theme.borderClassName} ${
        selected ? "ring-2 ring-blue-300" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-slate-500 transition-colors hover:!bg-blue-500"
      />

      <div className={`flex items-center gap-2 px-3 py-2 ${theme.headerClassName}`}>
        <span className="flex h-7 w-7 items-center justify-center rounded bg-white/15">
          <Icon aria-hidden="true" size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide">{theme.type}</div>
          <div className="truncate text-sm font-semibold">{data.label}</div>
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="text-xs leading-5 text-slate-600">{theme.description}</p>
        {theme.fields.length > 0 && (
          <dl className="space-y-1">
            {theme.fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 rounded bg-slate-50 px-2 py-1">
                <dt className="text-[10px] font-semibold uppercase text-slate-500">{field.label}</dt>
                <dd className="max-w-[96px] truncate text-xs font-medium text-slate-800">
                  {data.params?.[field.key] || field.fallback}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${theme.badgeClassName}`}>
          {theme.type}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-slate-500 transition-colors hover:!bg-blue-500"
      />
    </article>
  )
}
