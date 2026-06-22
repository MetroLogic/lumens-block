"use client"

import { X } from "lucide-react"
import type { Node } from "reactflow"
import type { BlockParameters } from "@/lib/compile/schema"
import { getConfigFields, mergeBlockConfig, type BlockConfigData } from "./blockConfig"

interface Props {
  selectedNode: Node<BlockConfigData> | null
  onClose: () => void
  onUpdateNode: (nodeId: string, data: BlockConfigData) => void
}

export default function ConfigPanel({ selectedNode, onClose, onUpdateNode }: Props) {
  if (!selectedNode) return null

  const type = selectedNode.type ?? "default"
  const fields = getConfigFields(type)
  const data = selectedNode.data ?? { label: type === "default" ? "Start" : type }

  const update = (patch: { label?: string; params?: Partial<BlockParameters> }) => {
    onUpdateNode(selectedNode.id, mergeBlockConfig(data, patch))
  }

  return (
    <aside className="absolute right-4 top-20 z-30 flex max-h-[calc(100%-10rem)] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{type}</p>
          <h2 className="truncate text-base font-semibold text-slate-900">Block configuration</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close block configuration"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-500">Label</span>
          <input
            type="text"
            value={data.label}
            onChange={(event) => update({ label: event.target.value })}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {fields.length === 0 ? (
          <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            This block has no additional parameters.
          </p>
        ) : (
          fields.map((field) => (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-500">{field.label}</span>
              <input
                type="text"
                value={data.params?.[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => update({ params: { [field.key]: event.target.value } })}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <span className="block text-xs leading-5 text-slate-500">{field.helper}</span>
            </label>
          ))
        )}
      </div>
    </aside>
  )
}
