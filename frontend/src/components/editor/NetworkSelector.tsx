"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import type { StellarNetwork } from "@/lib/stellar/deploy"
import { useNetwork } from "./NetworkContext"

export default function NetworkSelector() {
  const { network, setNetwork } = useNetwork()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const handleNetworkChange = (nextNetwork: StellarNetwork) => {
    if (nextNetwork === "mainnet" && network !== "mainnet") {
      setAcknowledged(false)
      setIsConfirmOpen(true)
      return
    }
    setNetwork(nextNetwork)
  }

  const confirmMainnet = () => {
    if (!acknowledged) return
    setNetwork("mainnet")
    setIsConfirmOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          aria-label="Stellar network"
          value={network}
          onChange={(event) => handleNetworkChange(event.target.value as StellarNetwork)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
        <span
          data-testid="network-badge"
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            network === "testnet"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
          }`}
        >
          {network === "testnet" ? "Testnet" : "Mainnet"}
        </span>
      </div>

      {isConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mainnet-confirmation-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-700 dark:bg-slate-800"
          >
            <h2 id="mainnet-confirmation-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Switch to Mainnet?
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Mainnet deployments spend real XLM and cannot be reversed. Test your contract on Testnet first.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5"
              />
              I understand this uses real XLM
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmMainnet}
                disabled={!acknowledged}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300 dark:disabled:bg-orange-900/50"
              >
                Switch to Mainnet
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
