"use client"

import { useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Cpu,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArgType = "Address" | "i128" | "bool" | "Symbol"

export interface InvokeArg {
  id: string
  type: ArgType
  value: string
}

export interface InvokeEvent {
  type: string
  topics: string[]
  data: string
}

export interface InvokeResources {
  instructions: number
  readBytes: number
  writeBytes: number
}

export interface InvokeResult {
  success: boolean
  returnValue: string
  events: InvokeEvent[]
  resources: InvokeResources
}

export interface InvokeErrorShape {
  error: { code: string; message: string }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ARG_TYPES: ArgType[] = ["Address", "i128", "bool", "Symbol"]

function ArgRow({
  arg,
  index,
  onChange,
  onRemove,
}: {
  arg: InvokeArg
  index: number
  onChange: (id: string, patch: Partial<InvokeArg>) => void
  onRemove: (id: string) => void
}) {
  const placeholder =
    arg.type === "Address"
      ? "G... (Stellar address)"
      : arg.type === "i128"
      ? "0"
      : arg.type === "bool"
      ? "true / false"
      : "symbol_name"

  return (
    <div className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-center text-xs text-gray-400 dark:text-slate-500">
        {index + 1}
      </span>
      <select
        value={arg.type}
        onChange={(e) => onChange(arg.id, { type: e.target.value as ArgType })}
        aria-label={`Arg ${index + 1} type`}
        className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {ARG_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={arg.value}
        placeholder={placeholder}
        onChange={(e) => onChange(arg.id, { value: e.target.value })}
        aria-label={`Arg ${index + 1} value`}
        className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 placeholder-gray-300 dark:placeholder-slate-500"
      />
      <button
        type="button"
        onClick={() => onRemove(arg.id)}
        aria-label={`Remove arg ${index + 1}`}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function ResourceBar({
  label,
  value,
  max,
  unit,
}: {
  label: string
  value: number
  max: number
  unit: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color =
    pct > 80 ? "bg-red-400" : pct > 50 ? "bg-amber-400" : "bg-emerald-400"

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-mono font-semibold text-gray-700 dark:text-slate-200">
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function EventCard({ event, index }: { event: InvokeEvent; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/40 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-200/60 px-1.5 py-0.5 font-mono text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 text-[10px]">
            #{index + 1}
          </span>
          <span className="font-semibold text-sky-900 dark:text-sky-200">
            {event.type}
          </span>
          {event.topics.length > 0 && (
            <span className="truncate max-w-[180px] text-sky-500 dark:text-sky-400">
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
        <div className="border-t border-sky-100 dark:border-sky-900/50 px-3 py-2 space-y-2">
          <div>
            <div className="mb-1 font-semibold text-sky-700 dark:text-sky-300">Topics</div>
            <div className="flex flex-wrap gap-1">
              {event.topics.length > 0 ? (
                event.topics.map((t, i) => (
                  <code
                    key={i}
                    className="rounded bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.5 font-mono text-sky-800 dark:text-sky-200"
                  >
                    {t}
                  </code>
                ))
              ) : (
                <span className="text-sky-400 italic">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-sky-700 dark:text-sky-300">Data</div>
            <code className="block rounded bg-sky-100 dark:bg-sky-900/60 px-2 py-1 font-mono text-sky-800 dark:text-sky-200 break-all">
              {event.data || "—"}
            </code>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** The contract ID populated from the last successful deploy. */
  deployedContractId: string | null
  /** The currently selected Stellar network. */
  network: string
}

function makeArgId() {
  return `arg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function InvokePanel({ deployedContractId, network }: Props) {
  const [isOpen, setIsOpen] = useState(true)
  const [contractId, setContractId] = useState<string>(deployedContractId ?? "")
  const [functionName, setFunctionName] = useState<string>("")
  const [args, setArgs] = useState<InvokeArg[]>([])
  const [status, setStatus] = useState<"idle" | "invoking" | "success" | "error">("idle")
  const [result, setResult] = useState<InvokeResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // Keep contractId in sync when a new deployment lands
  const [prevDeployed, setPrevDeployed] = useState(deployedContractId)
  if (deployedContractId !== prevDeployed) {
    setPrevDeployed(deployedContractId)
    if (deployedContractId) setContractId(deployedContractId)
  }

  const handleAddArg = () => {
    setArgs((prev) => [...prev, { id: makeArgId(), type: "Symbol", value: "" }])
  }

  const handleRemoveArg = (id: string) => {
    setArgs((prev) => prev.filter((a) => a.id !== id))
  }

  const handleArgChange = (id: string, patch: Partial<InvokeArg>) => {
    setArgs((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const handleInvoke = async () => {
    setStatus("invoking")
    setResult(null)
    setErrorMsg(null)
    setErrorCode(null)

    try {
      const payload = {
        contractId: contractId.trim(),
        network,
        functionName: functionName.trim(),
        args: args.map(({ type, value }) => ({ type, value })),
      }

      const res = await fetch("/api/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as InvokeResult | InvokeErrorShape

      if (!res.ok || "error" in data) {
        const errData = data as InvokeErrorShape
        setErrorCode(errData.error?.code ?? String(res.status))
        setErrorMsg(errData.error?.message ?? "Invocation failed.")
        setStatus("error")
        return
      }

      setResult(data as InvokeResult)
      setStatus("success")
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error during invocation.")
      setStatus("error")
    }
  }

  // Hide the panel entirely until a contract has been deployed
  if (!deployedContractId) return null

  return (
    <div
      data-testid="invoke-panel"
      className="absolute left-4 top-4 z-10 flex w-[360px] max-h-[calc(100%-6rem)] flex-col rounded-lg border bg-white shadow-md dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between border-b px-4 py-3 text-left dark:border-slate-700"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Invoke Contract
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-400">
            Call a function on your deployed contract
          </p>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-400 dark:text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 dark:text-slate-400" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Contract ID */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Contract ID
              </label>
              <input
                type="text"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                placeholder="C..."
                data-testid="invoke-contract-id"
                className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 placeholder-gray-300 dark:placeholder-slate-500"
              />
            </div>

            {/* Function Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                Function Name
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g. execute"
                data-testid="invoke-function-name"
                className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 placeholder-gray-300 dark:placeholder-slate-500"
              />
            </div>

            {/* Args */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                  Arguments
                </p>
                <button
                  type="button"
                  onClick={handleAddArg}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  data-testid="invoke-add-arg"
                >
                  <Plus size={11} />
                  Add arg
                </button>
              </div>

              {args.length === 0 ? (
                <p className="text-xs italic text-gray-400 dark:text-slate-500">
                  No arguments. Click "Add arg" to add one.
                </p>
              ) : (
                <div className="space-y-2">
                  {args.map((arg, idx) => (
                    <ArgRow
                      key={arg.id}
                      arg={arg}
                      index={idx}
                      onChange={handleArgChange}
                      onRemove={handleRemoveArg}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {status === "error" && (
              <div
                data-testid="invoke-error"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <div>
                  {errorCode && (
                    <code className="mb-0.5 block font-mono text-[10px] font-semibold">
                      {errorCode}
                    </code>
                  )}
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Success result */}
            {status === "success" && result && (
              <div data-testid="invoke-result" className="space-y-3">
                {/* Return value */}
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Invocation succeeded
                    </p>
                    {result.returnValue !== undefined && result.returnValue !== "" && (
                      <div className="mt-1.5">
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Return value
                        </span>
                        <code className="mt-0.5 block rounded bg-emerald-100 dark:bg-emerald-900/60 px-2 py-1 font-mono text-xs text-emerald-900 dark:text-emerald-200 break-all">
                          {result.returnValue}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Events */}
                {result.events.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-slate-300">
                      <Zap size={12} className="text-sky-500" />
                      Emitted Events
                      <span className="rounded-full bg-sky-100 dark:bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300">
                        {result.events.length}
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {result.events.map((ev, i) => (
                        <EventCard key={i} event={ev} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Resources */}
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-slate-300">
                    <Cpu size={12} className="text-violet-500" />
                    Resource Usage
                  </p>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/50 p-3 space-y-2">
                    <ResourceBar
                      label="CPU Instructions"
                      value={result.resources.instructions}
                      max={100_000_000}
                      unit="instr"
                    />
                    <ResourceBar
                      label="Read Bytes"
                      value={result.resources.readBytes}
                      max={131_072}
                      unit="B"
                    />
                    <ResourceBar
                      label="Write Bytes"
                      value={result.resources.writeBytes}
                      max={65_536}
                      unit="B"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Invoke button */}
          <div className="border-t px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => void handleInvoke()}
              disabled={status === "invoking"}
              data-testid="invoke-button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {status === "invoking" ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Invoking…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Invoke
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
