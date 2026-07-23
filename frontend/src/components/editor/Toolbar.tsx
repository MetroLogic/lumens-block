"use client"

import { Download, FilePlus2, FolderOpen, Moon, Sun, Upload } from "lucide-react"
import { useRef } from "react"
import { useTheme } from "./ThemeContext"

const BLOCK_TYPES = ["Condition", "Transfer", "Storage", "Event", "Auth"]

interface Props {
  onOpenShortcuts?: () => void
  onOpenTemplates?: () => void
  onAddBlock?: (type: string) => void
  onAutoLayout?: () => void
  onNew?: () => void
  onExport?: () => void
  onImport?: (file: File) => void
}

export default function Toolbar({
  onOpenShortcuts,
  onOpenTemplates,
  onAddBlock,
  onAutoLayout,
  onNew,
  onExport,
  onImport,
}: Props) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, toggleTheme } = useTheme()

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

  const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onImport?.(file)
    }
    // Allow re-selecting the same file
    event.target.value = ""
  }

  return (
    <div data-testid="toolbar" className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Blocks</p>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
            >
              ?
            </button>
          )}
        </div>
      </div>
      {BLOCK_TYPES.map((type, index) => (
        <div
          key={type}
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          draggable
          tabIndex={0}
          data-testid={`toolbar-block-${type.toLowerCase()}`}
          onDragStart={(e) => onDragStart(e, type)}
          onKeyDown={(e) => handleKeyDown(e, index, type)}
          className="cursor-grab rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 active:cursor-grabbing focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {type}
        </div>
      ))}

      <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2 flex flex-col gap-2">
        {onAutoLayout && (
          <button
            onClick={onAutoLayout}
            className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Auto Layout
          </button>
        )}
        {(onNew || onExport || onImport) && (
          <div className="flex flex-col gap-1.5">
            {onNew && (
              <button
                onClick={onNew}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FilePlus2 size={14} />
                New
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Download size={14} />
                Export JSON
              </button>
            )}
            {onImport && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Upload size={14} />
                  Import JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportChange}
                />
              </>
            )}
          </div>
        )}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FolderOpen size={14} />
            Templates
          </button>
        )}
      </div>
    </div>
  )
}
