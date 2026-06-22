"use client"

import { Handle, Position } from "reactflow"

interface InspectorNodeProps {
  data: {
    label: string
    caption?: string
    tone?: "contract" | "method" | "storage"
  }
}

const toneClasses = {
  contract: "border-blue-300 bg-blue-50 text-blue-950",
  method: "border-emerald-300 bg-emerald-50 text-emerald-950",
  storage: "border-amber-300 bg-amber-50 text-amber-950",
}

export default function InspectorNode({ data }: InspectorNodeProps) {
  const tone = data.tone ?? "contract"

  return (
    <div className={`min-w-[190px] max-w-[260px] rounded-lg border-2 px-4 py-3 shadow-sm ${toneClasses[tone]}`}>
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-slate-400" />
      <div className="text-sm font-semibold leading-tight">{data.label}</div>
      {data.caption && <div className="mt-2 break-words text-xs leading-relaxed opacity-75">{data.caption}</div>}
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-slate-400" />
    </div>
  )
}
