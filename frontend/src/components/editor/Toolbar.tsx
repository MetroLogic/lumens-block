"use client"

import { FolderOpen } from "lucide-react"
import { useRef } from "react"

const BLOCK_TYPES = ["Condition", "Transfer", "Storage", "Event", "Auth"]

interface Props {
  onOpenShortcuts?: () => void
  onOpenTemplates?: () => void
  onAddBlock?: (type: string) => void
}

export default function Toolbar({ onOpenShortcuts, onOpenTemplates, onAddBlock }: Props) {
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
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase">Blocks</p>
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="ml-2 flex h-5 w-5 items-center justify-center rounded-full border text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
          className="cursor-grab rounded border px-3 py-1.5 text-sm hover:bg-gray-50 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {type}
        </div>
      ))}

      <div className="mt-2 pt-2 border-t border-gray-100">
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <FolderOpen size={14} />
            Templates
          </button>
        )}
      </div>
    </div>
  )
}
