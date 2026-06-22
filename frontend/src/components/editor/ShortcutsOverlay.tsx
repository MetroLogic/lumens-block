"use client"

import { useEffect, useRef } from "react"

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
const mod = isMac ? "⌘" : "Ctrl"

const SHORTCUTS = [
  { keys: `${mod}+K`, description: "Open block palette" },
  { keys: `${mod}+Z`, description: "Undo" },
  { keys: `${mod}+Y`, description: "Redo" },
  { keys: "Delete / Backspace", description: "Remove selected block" },
  { keys: "Escape", description: "Close panel" },
  { keys: "Fit View", description: "Fit canvas to screen" },
  { keys: "?", description: "Toggle this overlay" },
]

interface Props {
  onClose: () => void
}

export default function ShortcutsOverlay({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus trap + close on Escape
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts overlay"
            className="text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Shortcut list */}
        <ul className="divide-y divide-gray-100 px-5 dark:divide-slate-800">
          {SHORTCUTS.map(({ keys, description }) => (
            <li key={keys} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600 dark:text-slate-300">{description}</span>
              <kbd className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>

        <div className="px-5 pb-4 pt-2 text-xs text-gray-400 dark:text-slate-500">
          {isMac ? "macOS" : "Windows / Linux"} shortcuts shown
        </div>
      </div>
    </div>
  )
}
