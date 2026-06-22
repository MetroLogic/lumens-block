"use client"

import { Download, FilePlus, FolderOpen, Upload } from "lucide-react"
import { useRef } from "react"

const BLOCK_TYPES = ["Condition", "Transfer", "Storage", "Event", "Auth"]

interface Props {
  onOpenShortcuts?: () => void
  onOpenTemplates?: () => void
  onAddBlock?: (type: string) => void
  onNewGraph?: () => void
  onExportGraph?: () => void
  onImportGraph?: () => void
}

export default function Toolbar({
  onOpenShortcuts,
  onOpenTemplates,
  onAddBlock,
  onNewGraph,
  onExportGraph,
  onImportGraph,
}: Props) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const onDragStart = (event: React.DragEvent, blockType: string) => {
    event.dataTransfer.setData("application/blocktype", blockType)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, type: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onAddBlock?.(type)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      const nextIndex = (index + 1) % BLOCK_TYPES.length
      itemRefs.current[nextIndex]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prevIndex = (index - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length
      itemRefs.current[prevIndex]?.focus()
    }
  }

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blocks</p>
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="ml-2 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ?
          </button>
        )}
      </div>
      {BLOCK_TYPES.map((type, index) => (
        <div
          key={type}
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          draggable
          tabIndex={0}
          onDragStart={(e) => onDragStart(e, type)}
          onKeyDown={(e) => handleKeyDown(e, index, type)}
          className="cursor-grab rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 active:cursor-grabbing focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {type}
        </div>
      ))}

      {(onNewGraph || onExportGraph || onImportGraph) && (
        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2">
          {onNewGraph && (
            <button
              type="button"
              onClick={onNewGraph}
              aria-label="New graph"
              title="New graph"
              className="flex h-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FilePlus size={15} />
            </button>
          )}
          {onImportGraph && (
            <button
              type="button"
              onClick={onImportGraph}
              aria-label="Import JSON"
              title="Import JSON"
              className="flex h-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Upload size={15} />
            </button>
          )}
          {onExportGraph && (
            <button
              type="button"
              onClick={onExportGraph}
              aria-label="Export JSON"
              title="Export JSON"
              className="flex h-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Download size={15} />
            </button>
          )}
        </div>
      )}

      {onOpenTemplates && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <button
            onClick={onOpenTemplates}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FolderOpen size={14} />
            Templates
          </button>
        </div>
      )}
    </div>
  )
}
