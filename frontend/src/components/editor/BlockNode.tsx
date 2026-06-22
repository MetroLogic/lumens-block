"use client"

import React from "react"
import { Handle, Position } from "reactflow"

const SOURCE_HANDLES: Record<string, Array<{ id: string; label: string; className: string; top: string }>> = {
  Condition: [
    {
      id: "condition-true",
      label: "true",
      className: "!bg-emerald-500 hover:!bg-emerald-600",
      top: "70%",
    },
    {
      id: "condition-false",
      label: "false",
      className: "!bg-rose-500 hover:!bg-rose-600",
      top: "88%",
    },
  ],
  Transfer: [
    {
      id: "transfer-success",
      label: "success",
      className: "!bg-emerald-500 hover:!bg-emerald-600",
      top: "70%",
    },
    {
      id: "transfer-failure",
      label: "failure",
      className: "!bg-amber-500 hover:!bg-amber-600",
      top: "88%",
    },
  ],
}

export default function BlockNode({ type, data }: { type: string; data: { label: string } }) {
  let colorClasses = "bg-white border-gray-300 text-gray-800"
  let badgeColor = "bg-gray-100 text-gray-600"
  const sourceHandles = SOURCE_HANDLES[type] ?? []
  
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
      </div>

      {sourceHandles.length > 0 ? (
        sourceHandles.map((handle) => (
          <React.Fragment key={handle.id}>
            <span
              className="absolute -right-16 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 shadow-sm"
              style={{ top: handle.top, transform: "translateY(-50%)" }}
            >
              {handle.label}
            </span>
            <Handle
              id={handle.id}
              type="source"
              position={Position.Right}
              className={`!h-3 !w-3 transition-colors ${handle.className}`}
              style={{ top: handle.top }}
            />
          </React.Fragment>
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
        />
      )}
    </div>
  )
}
