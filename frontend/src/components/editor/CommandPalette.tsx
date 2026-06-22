"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { BLOCK_CATALOG, filterBlockCatalog, type EditorBlockType } from "./blockCatalog"

interface Props {
  onClose: () => void
  onSelectBlock: (type: EditorBlockType) => void
}

export default function CommandPalette({ onClose, onSelectBlock }: Props) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => filterBlockCatalog(query), [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const selectBlock = (type: EditorBlockType) => {
    onSelectBlock(type)
    onClose()
  }

  const focusableElements = () =>
    Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((index) => (index + 1) % results.length)
      }
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (results.length > 0) {
        setActiveIndex((index) => (index - 1 + results.length) % results.length)
      }
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const activeResult = results[activeIndex]
      if (activeResult) {
        selectBlock(activeResult.type)
      }
      return
    }

    if (event.key === "Tab") {
      const focusable = focusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 pt-24"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-command-palette-title"
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="block-command-palette-title" className="text-sm font-semibold text-slate-900">
              Add block
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close command palette"
              className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks by name or behavior"
            className="mt-3 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            aria-label="Search blocks"
            aria-controls="block-command-palette-results"
            aria-activedescendant={results[activeIndex] ? `block-command-${results[activeIndex].type}` : undefined}
          />
        </div>

        <div id="block-command-palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length > 0 ? (
            results.map((block, index) => {
              const active = index === activeIndex
              return (
                <button
                  key={block.type}
                  id={`block-command-${block.type}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectBlock(block.type)}
                  className={`w-full rounded px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active ? "bg-blue-50 text-blue-950" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-sm font-semibold">{block.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{block.description}</span>
                </button>
              )
            })
          ) : (
            <div className="px-3 py-8 text-center text-sm text-slate-500" role="status">
              No blocks match your search.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span>{results.length} of {BLOCK_CATALOG.length} blocks</span>
          <span>Use arrows and Enter</span>
        </div>
      </div>
    </div>
  )
}
