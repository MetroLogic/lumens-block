"use client"

import { FolderOpen } from "lucide-react"

const BLOCK_TYPES = ["Condition", "Transfer", "Storage", "Event", "Auth"]

interface Props {
  onOpenShortcuts: () => void
}

export default function Toolbar({ onOpenShortcuts }: Props) {
  onOpenTemplates: () => void
}

export default function Toolbar({ onOpenTemplates }: Props) {
  const onDragStart = (event: React.DragEvent, blockType: string) => {
    event.dataTransfer.setData("application/blocktype", blockType)
  }

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase">Blocks</p>
        <button
          onClick={onOpenShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="ml-2 flex h-5 w-5 items-center justify-center rounded-full border text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          ?
        </button>
      </div>
      {BLOCK_TYPES.map((type) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          className="cursor-grab rounded border px-3 py-1.5 text-sm hover:bg-gray-50 active:cursor-grabbing"
        >
          {type}
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <button
          onClick={onOpenTemplates}
          className="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition-colors"
        >
          <FolderOpen size={14} />
          Templates
        </button>
      </div>
    </div>
  )
}

