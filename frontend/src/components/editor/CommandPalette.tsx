"use client"

import { useEffect, useRef, useState } from "react"

const BLOCK_TYPES = [
  { type: "Condition", description: "Branch logic based on a condition" },
  { type: "Transfer", description: "Send tokens or assets" },
  { type: "Storage", description: "Read or write contract storage" },
  { type: "Event", description: "Emit an event from the contract" },
  { type: "Auth", description: "Authorize a signer or require authentication" },
]

interface Props {
  onSelect: (blockType: string) => void
  onClose: () => void
}

/**
 * Simple fuzzy match: checks if all characters of the query appear in order
 * in the target string (case-insensitive).
 */
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

export default function CommandPalette({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query
    ? BLOCK_TYPES.filter(
        (b) =>
          fuzzyMatch(query, b.type) || fuzzyMatch(query, b.description),
      )
    : BLOCK_TYPES

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }

      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault()
        onSelect(filtered[selectedIndex].type)
        onClose()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [filtered, selectedIndex, onSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Block search palette"
    >
      <div className="w-full max-w-md rounded-xl border bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/60">
        {/* Search input */}
        <div className="flex items-center border-b px-4 dark:border-slate-700">
          <svg
            className="mr-2 h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks…"
            className="w-full bg-transparent py-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {/* Block list */}
        <div ref={listRef} className="max-h-64 overflow-y-auto px-2 py-2" role="listbox" aria-label="Available blocks">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No blocks found
            </div>
          )}
          {filtered.map((block, i) => (
            <button
              key={block.type}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => {
                onSelect(block.type)
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {block.type.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="font-medium">{block.type}</div>
                <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                  {block.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span>
            <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
              ↵
            </kbd>{" "}
            select
          </span>
          <span>
            <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  )
}