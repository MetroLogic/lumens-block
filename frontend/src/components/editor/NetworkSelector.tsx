"use client"

import { useCallback, useEffect, useState } from "react"
import type { StellarNetwork } from "@/lib/stellar/deploy"

const STORAGE_KEY = "lumens_selected_network"

function getStoredNetwork(): StellarNetwork | null {
  if (typeof localStorage === "undefined") return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "testnet" || stored === "mainnet") return stored
  } catch {
    // localStorage unavailable or quota exceeded
  }
  return null
}

function storeNetwork(network: StellarNetwork): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, network)
  } catch {
    // Silently ignore storage errors
  }
}

interface Props {
  value: StellarNetwork
  onChange: (network: StellarNetwork) => void
}

export default function NetworkSelector({ value, onChange }: Props) {
  const [isMainnetConfirmOpen, setIsMainnetConfirmOpen] = useState(false)
  const [pendingNetwork, setPendingNetwork] = useState<StellarNetwork | null>(null)

  // Restore persisted network on mount
  useEffect(() => {
    const stored = getStoredNetwork()
    if (stored && stored !== value) {
      onChange(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (next: StellarNetwork) => {
      if (next === "mainnet") {
        setPendingNetwork("mainnet")
        setIsMainnetConfirmOpen(true)
      } else {
        onChange(next)
        storeNetwork(next)
      }
    },
    [onChange]
  )

  const handleConfirmMainnet = useCallback(() => {
    if (pendingNetwork) {
      onChange(pendingNetwork)
      storeNetwork(pendingNetwork)
    }
    setIsMainnetConfirmOpen(false)
    setPendingNetwork(null)
  }, [onChange, pendingNetwork])

  const handleCancelMainnet = useCallback(() => {
    setIsMainnetConfirmOpen(false)
    setPendingNetwork(null)
  }, [])

  const isMainnet = value === "mainnet"

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isMainnet
              ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]"
              : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
          }`}
          aria-hidden="true"
        />
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value as StellarNetwork)}
          className={`rounded border px-2 py-1 text-sm font-medium transition-colors ${
            isMainnet
              ? "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
          }`}
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
        {isMainnet && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
            Live
          </span>
        )}
      </div>

      {isMainnetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-orange-200 bg-white p-6 shadow-xl dark:border-orange-800 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Switch to Mainnet
              </h3>
              <button
                onClick={handleCancelMainnet}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-950/40">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  ⚠️ Real XLM will be spent
                </p>
                <p className="mt-1 text-orange-700 dark:text-orange-300">
                  Mainnet deployments use real Stellar lumens (XLM). Make sure you
                  understand the costs before proceeding.
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can switch back to Testnet at any time by selecting it from the
                network dropdown.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={handleCancelMainnet}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMainnet}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
              >
                Switch to Mainnet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Export for testing
export { getStoredNetwork, storeNetwork, STORAGE_KEY }