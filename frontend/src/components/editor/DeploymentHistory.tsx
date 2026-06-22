"use client"

import { Copy, ExternalLink, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getStellarExpertContractUrl,
  getStellarExpertTransactionUrl,
  readDeploymentHistory,
  removeDeploymentRecord,
  type DeploymentRecord,
} from "@/lib/stellar/deploymentHistory"

interface Props {
  isOpen: boolean
  onClose: () => void
  refreshToken?: number
}

function shorten(value: string, prefix = 10, suffix = 8) {
  if (value.length <= prefix + suffix + 3) return value
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function DetailRow({
  label,
  value,
  onCopy,
  href,
}: {
  label: string
  value?: string
  onCopy?: (value: string) => void
  href?: string | null
}) {
  if (!value) {
    return (
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-400">Pending</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <code className="truncate rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-700">
          {shorten(value)}
        </code>
        {onCopy && (
          <button
            type="button"
            onClick={() => onCopy(value)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            <Copy size={13} />
          </button>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Open ${label} on Stellar Expert`}
            title={`Open ${label} on Stellar Expert`}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

export default function DeploymentHistory({ isOpen, onClose, refreshToken }: Props) {
  const [records, setRecords] = useState<DeploymentRecord[]>([])
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRecords(readDeploymentHistory())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshToken])

  useEffect(() => {
    if (isOpen) refresh()
  }, [isOpen, refresh])

  const latestId = useMemo(() => records[0]?.id ?? null, [records])

  const handleCopy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(null), 1500)
  }

  const handleDelete = (id: string) => {
    setRecords(removeDeploymentRecord(id))
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Deployment History</h2>
          <p className="text-xs text-slate-500">{records.length} saved records</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close deployment history"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {copiedLabel && (
        <p role="status" className="mx-5 mt-4 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Copied {copiedLabel}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {records.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">No deployments yet</p>
            <p className="mt-1 text-xs text-slate-500">Successful deployments will appear here.</p>
          </div>
        )}

        {records.length > 0 && (
          <div className="space-y-3">
            {records.map((record) => {
              const txUrl = getStellarExpertTransactionUrl(record)
              const contractUrl = getStellarExpertContractUrl(record)

              return (
                <article key={record.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase text-white">
                          {record.network}
                        </span>
                        {record.id === latestId && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">
                            Latest
                          </span>
                        )}
                      </div>
                      <time className="mt-2 block text-xs text-slate-500" dateTime={record.createdAt}>
                        {formatDate(record.createdAt)}
                      </time>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Delete deployment record"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <DetailRow
                      label="Contract ID"
                      value={record.contractId}
                      onCopy={(value) => void handleCopy("contract ID", value)}
                      href={contractUrl}
                    />
                    <DetailRow
                      label="Transaction"
                      value={record.transactionHash}
                      onCopy={(value) => void handleCopy("transaction hash", value)}
                      href={txUrl}
                    />
                    <DetailRow
                      label="Deployer"
                      value={record.deployer}
                      onCopy={(value) => void handleCopy("deployer", value)}
                    />
                    <DetailRow label="Fee" value={record.estimatedFee ? `${record.estimatedFee} XLM` : undefined} />
                  </div>

                  {(record.sourceHash || record.wasmHash || record.sizeBytes || record.message) && (
                    <div className="mt-4 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {record.message && <p className="leading-relaxed">{record.message}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {record.sourceHash && (
                          <span className="rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-600">
                            source {shorten(record.sourceHash, 8, 6)}
                          </span>
                        )}
                        {record.wasmHash && (
                          <span className="rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-600">
                            wasm {shorten(record.wasmHash, 8, 6)}
                          </span>
                        )}
                        {record.sizeBytes && (
                          <span className="rounded bg-white px-2 py-1 text-[11px] text-slate-600">
                            {record.sizeBytes.toLocaleString()} bytes
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
