"use client"

import { useEffect, useRef, useState } from "react"
import { X, Play, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Cpu, Database, Zap } from "lucide-react"
import type { SimulateArg, SimulateEvent, SimulateResult } from "@/lib/stellar/simulate"

// ─── Arg Input ────────────────────────────────────────────────────────────────

interface ArgRowProps {
  arg: SimulateArg
  onChange: (name: string, value: string) => void
}

function ArgRow({ arg, onChange }: ArgRowProps) {
  const placeholder =
    arg.type === "address"
      ? "G... (Stellar address)"
      : arg.type === "number"
      ? "0"
      : arg.type === "boolean"
      ? "true / false"
      : '""'

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
        <span>{arg.name}</span>
        <span className="rounded px-1.5 py-0.5 bg-gray-100 text-gray-400 font-mono text-[10px]">
          {arg.type}
        </span>
      </label>
      <input
        type="text"
        value={arg.value}
        placeholder={placeholder}
        onChange={(e) => onChange(arg.name, e.target.value)}
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
      />
    </div>
  )
}

// ─── Resource Bar ──────────────────────────────────────────────────────────────

function ResourceBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct > 80 ? "bg-red-400" : pct > 50 ? "bg-amber-400" : "bg-emerald-400"

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-mono font-semibold text-gray-700">
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: SimulateEvent; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-200/60 px-1.5 py-0.5 font-mono text-sky-700 text-[10px]">
            #{index + 1}
          </span>
          <span className="font-semibold text-sky-900">{event.type}</span>
          {event.topics.length > 0 && (
            <span className="text-sky-500 truncate max-w-[200px]">
              {event.topics.join(", ")}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={12} className="text-sky-400 shrink-0" />
        ) : (
          <ChevronDown size={12} className="text-sky-400 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-sky-100 px-3 py-2">
          <div className="mb-1 font-semibold text-sky-700">Topics</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {event.topics.length > 0 ? (
              event.topics.map((t, i) => (
                <code key={i} className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-sky-800">
                  {t}
                </code>
              ))
            ) : (
              <span className="text-sky-400 italic">—</span>
            )}
          </div>
          <div className="mb-1 font-semibold text-sky-700">Data</div>
          <code className="block rounded bg-sky-100 px-2 py-1 font-mono text-sky-800 break-all">
            {event.data || "—"}
          </code>
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  args: SimulateArg[]
  onArgsChange: (args: SimulateArg[]) => void
  onSimulate: () => void
  status: "idle" | "simulating" | "success" | "error"
  result: SimulateResult | null
}

export default function SimulateModal({
  isOpen,
  onClose,
  args,
  onArgsChange,
  onSimulate,
  status,
  result,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleArgChange = (name: string, value: string) => {
    onArgsChange(args.map((a) => (a.name === name ? { ...a, value } : a)))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulate-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-gray-100 bg-white shadow-2xl outline-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <h2 id="simulate-title" className="text-lg font-bold text-gray-900">
              Simulate Contract
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Dry-run your contract via Stellar RPC — no transaction submitted
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close simulation modal"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Arguments */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Invocation Arguments</h3>
            {args.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No arguments inferred from the graph.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {args.map((arg) => (
                  <ArgRow key={arg.name} arg={arg} onChange={handleArgChange} />
                ))}
              </div>
            )}
          </section>

          {/* Result */}
          {(status === "success" || status === "error") && result && (
            <>
              {/* Status banner */}
              <section>
                {result.success ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800">Simulation succeeded</p>
                      {result.returnValue !== undefined && (
                        <div className="mt-2">
                          <span className="text-xs text-emerald-600 font-semibold">Return value</span>
                          <code className="block mt-1 rounded bg-emerald-100 px-3 py-2 font-mono text-sm text-emerald-900 break-all">
                            {result.returnValue}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-800">Simulation failed</p>
                      {result.errorCode && (
                        <code className="inline-block mt-1 rounded bg-red-100 px-2 py-0.5 font-mono text-xs text-red-700">
                          {result.errorCode}
                        </code>
                      )}
                      {result.error && (
                        <p className="mt-1 text-xs text-red-700 break-all">{result.error}</p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Events */}
              {result.events.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <Zap size={14} className="text-sky-500" />
                    Emitted Events
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-600">
                      {result.events.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {result.events.map((ev, i) => (
                      <EventCard key={i} event={ev} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Resource usage */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Cpu size={14} className="text-violet-500" />
                  Resource Usage
                </h3>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <ResourceBar
                      label="CPU Instructions"
                      value={result.resources.instructions}
                      max={100_000_000}
                      unit="instr"
                    />
                    <ResourceBar
                      label="Memory"
                      value={result.resources.memBytes}
                      max={40_960_000}
                      unit="bytes"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Database size={12} className="text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">
                        Ledger reads:{" "}
                        <span className="font-semibold text-gray-700">
                          {result.resources.readEntries} entries / {result.resources.readBytes.toLocaleString()} B
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database size={12} className="text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">
                        Ledger writes:{" "}
                        <span className="font-semibold text-gray-700">
                          {result.resources.writeEntries} entries / {result.resources.writeBytes.toLocaleString()} B
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSimulate}
            disabled={status === "simulating"}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {status === "simulating" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Simulating…
              </>
            ) : (
              <>
                <Play size={14} />
                Run Simulation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
