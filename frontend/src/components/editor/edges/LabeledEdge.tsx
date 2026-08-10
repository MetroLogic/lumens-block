"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "reactflow"
import { useEdgeLabelContext } from "./EdgeLabelContext"

export type LabeledEdgeData = Record<string, unknown> & {
  label?: string
}

export type LabeledEdgeType = Edge<LabeledEdgeData>

/**
 * Custom React Flow edge that renders a branch label (e.g. "true", "false")
 * at the midpoint of the bezier path. Clicking the label opens an inline
 * editor for the user to edit or set a label.
 */
export default function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<LabeledEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const { editingEdgeId, beginEdit, commitLabel, cancelEdit } =
    useEdgeLabelContext()
  const isEditing = editingEdgeId === id
  const label = data?.label
  const [editValue, setEditValue] = useState(label ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(label ?? "")
    }
  }, [isEditing, label])

  const handleCommit = useCallback(() => {
    commitLabel(id, editValue.trim())
  }, [commitLabel, editValue, id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCommit()
      } else if (e.key === "Escape") {
        cancelEdit()
      }
    },
    [handleCommit, cancelEdit]
  )

  // Show label badge if there's a label OR if this edge is selected
  const showLabel = label || selected

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={selected ? { stroke: "#3b82f6", strokeWidth: 2 } : undefined}
      />
      {showLabel && (
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
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleCommit}
                onKeyDown={handleKeyDown}
                className="rounded border border-blue-400 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-800 shadow-md outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100"
                style={{ minWidth: 40, maxWidth: 120 }}
              />
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  beginEdit(id)
                }}
                className="cursor-pointer rounded-full border border-slate-300 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm hover:border-blue-400 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                title="Click to edit label"
              >
                {label}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}