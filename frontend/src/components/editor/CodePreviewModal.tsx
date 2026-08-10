"use client"

import { useMemo, useState } from "react"
import type { Node, Edge } from "reactflow"
import { toContractGraph } from "@/lib/editor/graphPersistence"
import { compileGraph } from "@/lib/compiler"
import { useToast } from "./ToastProvider"

interface Props {
  isOpen: boolean
  onClose: () => void
  nodes: Node[]
  edges: Edge[]
}

export default function CodePreviewModal({ isOpen, onClose, nodes, edges }: Props) {
  const [copied, setCopied] = useState(false)
  const { success: toastSuccess } = useToast()

  const { code, error, warnings } = useMemo(() => {
    if (!isOpen) return { code: "", error: null, warnings: [] }
    const graph = toContractGraph(nodes, edges)
    const collectedWarnings: string[] = []
    try {
      const generatedCode = compileGraph(graph, {
        onWarning: (w) => collectedWarnings.push(w),
      })
      return { code: generatedCode, error: null, warnings: collectedWarnings }
    } catch (err) {
      return {
        code: "",
        error: err instanceof Error ? err.message : "Failed to compile contract graph",
        warnings: collectedWarnings,
      }
    }
  }, [isOpen, nodes, edges])

  if (!isOpen) return null

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toastSuccess("Code copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is restricted
    }
  }

  const lines = code.split("\n")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <span className="font-mono text-base font-bold">&lt;/&gt;</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Generated Soroban Contract
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Read-only code compiled from your visual graph
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {code && (
              <button
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copied ? "Copied! ✓" : "Copy Code"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            {warnings.map((w, idx) => (
              <p key={idx}>{w}</p>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 font-mono text-sm">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <h3 className="font-semibold text-red-900 dark:text-red-200">Compilation Error</h3>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          ) : (
            <div className="relative rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:border-slate-800">
              <pre className="overflow-x-auto leading-relaxed">
                {lines.map((line, index) => (
                  <div key={index} className="table-row">
                    <span className="table-cell select-none pr-4 text-right text-slate-600">
                      {index + 1}
                    </span>
                    <span className="table-cell whitespace-pre">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Language: Rust (Soroban SDK)
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
