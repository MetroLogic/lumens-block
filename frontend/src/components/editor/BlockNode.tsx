"use client"

import { Handle, Position } from "reactflow"

export default function BlockNode({
  type,
  data,
}: {
  type: string
  data: { label: string; validationError?: boolean; validationMessages?: string[] }
}) {
  let colorClasses = "bg-white border-gray-300 text-gray-800"
  let badgeColor = "bg-gray-100 text-gray-600"
  
  switch (type) {
    case "Condition":
      colorClasses = "bg-rose-50 border-rose-300 text-rose-900 shadow-rose-100"
      badgeColor = "bg-rose-200/60 text-rose-800"
      break
    case "Transfer":
      colorClasses = "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-100"
      badgeColor = "bg-emerald-200/60 text-emerald-800"
      break
    case "Storage":
      colorClasses = "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100"
      badgeColor = "bg-amber-200/60 text-amber-800"
      break
    case "Event":
      colorClasses = "bg-sky-50 border-sky-300 text-sky-900 shadow-sky-100"
      badgeColor = "bg-sky-200/60 text-sky-800"
      break
    case "Auth":
      colorClasses = "bg-purple-50 border-purple-300 text-purple-900 shadow-purple-100"
      badgeColor = "bg-purple-200/60 text-purple-800"
      break
    case "default":
      colorClasses = "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100"
      badgeColor = "bg-blue-200/60 text-blue-800"
      break
  }

  if (data.validationError) {
    colorClasses = `${colorClasses} !border-red-500 ring-2 ring-red-200`
  }

  return (
    <div className={`relative px-4 py-3 rounded-xl border-2 shadow-sm font-sans min-w-[150px] text-center ${colorClasses}`}>
      {/* Target handle on top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />
      
      <div className="flex flex-col items-center gap-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
          {type === "default" ? "Start" : type}
        </span>
        <div className="text-sm font-semibold mt-1">{data.label}</div>
        {data.validationError && (
          <div className="mt-1 max-w-[150px] truncate text-[11px] font-medium text-red-700">
            {data.validationMessages?.[0] ?? "Validation error"}
          </div>
        )}
      </div>

      {/* Source handle on bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />
    </div>
  )
}
