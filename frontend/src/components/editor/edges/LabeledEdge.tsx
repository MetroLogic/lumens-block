"use client"

import { memo, useCallback, useEffect, useState } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow"
import { normalizeEdgeLabel, type EdgeLabelData } from "./edgeLabels"

type Props = EdgeProps<EdgeLabelData> & {
  isEditing?: boolean
  onEditStart?: (edgeId: string) => void
  onEditEnd?: () => void
  onLabelChange?: (edgeId: string, label: string) => void
}

function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
  isEditing: isEditingProp,
  onEditStart,
  onEditEnd,
  onLabelChange,
}: Props) {
  const label = data?.label ?? ""
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  useEffect(() => {
    if (isEditingProp) {
      setDraft(label)
      setIsEditing(true)
    }
  }, [isEditingProp, label])

  const save = useCallback(() => {
    onLabelChange?.(id, normalizeEdgeLabel(draft) ?? "")
    setIsEditing(false)
    onEditEnd?.()
  }, [draft, id, onEditEnd, onLabelChange])

  const startEditing = () => {
    setDraft(label)
    setIsEditing(true)
    onEditStart?.(id)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: selected ? "#3b82f6" : "#94a3b8", strokeWidth: selected ? 2 : 1.5 }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              maxLength={32}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={save}
              onKeyDown={(event) => {
                if (event.key === "Enter") save()
                if (event.key === "Escape") {
                  setIsEditing(false)
                  onEditEnd?.()
                }
              }}
              className="w-24 rounded border border-blue-300 bg-white px-2 py-1 text-center text-xs font-medium text-slate-800 shadow-sm outline-none ring-2 ring-blue-100"
              aria-label="Edge label"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className={`rounded-full border px-2 py-1 text-xs font-semibold shadow-sm transition ${
                label
                  ? "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  : "border-dashed border-slate-300 bg-white/80 text-slate-400 hover:border-blue-300 hover:text-blue-600"
              }`}
              aria-label={label ? `Edit edge label ${label}` : "Add edge label"}
            >
              {label || "label"}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(LabeledEdge)
