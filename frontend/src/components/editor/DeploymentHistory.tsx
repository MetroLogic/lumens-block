"use client"

import { Clipboard, ExternalLink, Trash2, X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { loadDeployments, removeDeployment, type DeploymentRecord } from "@/lib/editor/deploymentHistory"

interface Props {
  isOpen: boolean
  onClose: () => void
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2 + 3) return hash
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`
}

function getExplorerUrl(network: "testnet" | "mainnet", txHash: string): string {
  const base = network === "testnet" ? "https://testnet.stellarexpert.com" : "https://stellarexpert.com"
  return `${base}/tx/${txHash}`
}

export default function DeploymentHistory({ isOpen, onClose }: Props) {
  const [records, setRecords] = useState<DeploymentRecord[]>(() => loadDeployments())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleDelete = useCallback(
    (id: string) => {
      setRecords(removeDeployment(id))
    },
    []
  )

  const handleCopy = useCallback(async (text: string, recordId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(recordId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Clipboard API unavailable — fall back silently.
    }
  }, [])

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [records]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 cursor-pointer" onClick={onClose} aria-label="Close deployment history" />
      <div
        className="flex h-full w-96 flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
        role="dialog"
        aria-label="Deployment history"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deployment History</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Records */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedRecords.length === 0 ? (
            <p className="mt-12 text-center text-sm text-slate-400 dark:text-slate-500">
              No deployments yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedRecords.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatTimestamp(record.timestamp)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        record.network === "testnet"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      {record.network}
                    </span>
                  </div>

                  {/* Contract ID */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                      {record.contractId}
                    </span>
                    <button
                      onClick={() => void handleCopy(record.contractId, `contract-${record.id}`)}
                      aria-label="Copy contract ID"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    >
                      {copiedId === `contract-${record.id}` ? (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">OK</span>
                      ) : (
                        <Clipboard size={13} />
                      )}
                    </button>
                  </div>

                  {/* Transaction hash */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="flex-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {truncateHash(record.txHash)}
                    </span>
                    <button
                      onClick={() => void handleCopy(record.txHash, `tx-${record.id}`)}
                      aria-label="Copy transaction hash"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    >
                      {copiedId === `tx-${record.id}` ? (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">OK</span>
                      ) : (
                        <Clipboard size={13} />
                      )}
                    </button>
                    <a
                      href={getExplorerUrl(record.network, record.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on Stellar Expert"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => handleDelete(record.id)}
                      aria-label="Delete deployment record"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}