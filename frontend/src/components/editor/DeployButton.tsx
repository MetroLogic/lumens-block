"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Node, Edge } from "reactflow"
import { CompileContractError, deployContract, estimateDeploymentFee, type StellarNetwork } from "@/lib/stellar/deploy"
import { X } from "lucide-react"

interface Props {
  nodes: Node[]
  edges: Edge[]
  disabled?: boolean
  selectedNetwork: StellarNetwork
  walletAddress: string | null
  walletBalance: string
}

function mapErrorToFriendlyMessage(err: unknown): string {
  if (err instanceof CompileContractError) {
    return err.message
  }

  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  // Freighter wallet rejection
  if (
    lower.includes("freighter") &&
    (lower.includes("reject") || lower.includes("denied") || lower.includes("cancel"))
  ) {
    return "Transaction was rejected in Freighter. Please approve the signing request to deploy."
  }

  // Freighter not installed
  if (lower.includes("freighter") && (lower.includes("not found") || lower.includes("not installed") || lower.includes("install"))) {
    return "Freighter wallet extension not found. Please install it from https://freighter.app/"
  }

  // Freighter locked
  if (lower.includes("freighter") && lower.includes("unlock")) {
    return "Freighter wallet is locked. Please unlock it and try again."
  }

  // Insufficient balance
  if (lower.includes("insufficient") || lower.includes("balance") || lower.includes("not enough") || lower.includes("shortfall")) {
    return "Insufficient XLM balance. Fund your Testnet account at https://laboratory.stellar.org/"
  }

  // Network / timeout
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused") || lower.includes("enosys")) {
    return "Network request timed out. Please check your internet connection and try again."
  }

  // RPC / transaction failure
  if (lower.includes("rpc") || lower.includes("soroban") || lower.includes("simulation") || lower.includes("sequence")) {
    return `Transaction failed: ${message}`
  }

  console.error("[DeployButton] Unhandled error:", err)
  return "Deployment failed. Check the console for details."
}

export default function DeployButton({
  nodes,
  edges,
  disabled = false,
  selectedNetwork,
  walletAddress,
  walletBalance,
}: Props) {
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const handleEstimate = useCallback(async () => {
    if (!walletAddress) {
      setEstimatedFee(null)
      setEstimateError(null)
      return
    }

    setIsEstimating(true)
    setEstimateError(null)

    try {
      const fee = await estimateDeploymentFee({ nodes, edges }, selectedNetwork, walletAddress)
      setEstimatedFee(fee)
    } catch (error) {
      setEstimatedFee(null)
      setEstimateError(error instanceof Error ? error.message : "Unable to estimate fee")
    } finally {
      setIsEstimating(false)
    }
  }, [edges, nodes, selectedNetwork, walletAddress])

  useEffect(() => {
    if (!isConfirmOpen) return
    void handleEstimate()
  }, [handleEstimate, isConfirmOpen])

  const balanceNumber = useMemo(() => {
    const parsed = Number.parseFloat(walletBalance)
    return Number.isFinite(parsed) ? parsed : null
  }, [walletBalance])

  const feeNumber = useMemo(() => {
    const parsed = estimatedFee ? Number.parseFloat(estimatedFee) : null
    return Number.isFinite(parsed) ? parsed : null
  }, [estimatedFee])

  const shortfall = useMemo(() => {
    if (balanceNumber === null || feeNumber === null) return null
    return Math.max(feeNumber - balanceNumber, 0)
  }, [balanceNumber, feeNumber])

  const hasEnoughBalance = shortfall === null ? false : shortfall === 0

  const handleDeploy = async () => {
    if (!walletAddress) {
      setMessage("Connect your wallet before deploying.")
      return
    }

    setStatus("deploying")
    setMessage(null)

    try {
      const result = await deployContract({ nodes, edges }, selectedNetwork, (stage) => {
        setMessage(stage)
      })
      setStatus("success")
      setMessage(result)
      setErrorMessage(null)
      setIsConfirmOpen(false)
    } catch (err) {
      console.error("[DeployButton] Deployment failed:", err)
      setStatus("error")
      const friendly = mapErrorToFriendlyMessage(err)
      setErrorMessage(friendly)
      setMessage(friendly)
    }
  }

  const labels = {
    idle: "Deploy Contract",
    deploying: "Compiling...",
    success: "Compiled ✓",
    error: "Failed — Retry",
  }

  return (
    <>
      {message && status === "error" && errorMessage && (
        <div
          role="alert"
          className="relative flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 pr-8 text-xs shadow dark:border-red-800 dark:bg-red-950/40"
        >
          <span className="mt-0.5 text-red-800 dark:text-red-300">{errorMessage}</span>
          <button
            onClick={() => {
              setMessage(null)
              setErrorMessage(null)
              setStatus("idle")
            }}
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/50"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {message && status === "success" && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 shadow dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
        >
          {message}
        </p>
      )}
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={status === "deploying" || disabled}
        title={disabled ? "Fix failing tests or enable override to deploy" : undefined}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {labels[status]}
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm deployment</h3>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                <span>Estimated fee</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {isEstimating ? "Estimating..." : estimatedFee ? `${estimatedFee} XLM` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                <span>Wallet balance</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{walletBalance} XLM</span>
              </div>
            </div>

            {estimateError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{estimateError}</p>
            )}

            {shortfall !== null && shortfall > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Insufficient balance. You are short by {shortfall.toFixed(7)} XLM.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeploy()}
                disabled={!walletAddress || !estimatedFee || !hasEnoughBalance || status === "deploying"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-900/50"
              >
                {status === "deploying" ? "Signing..." : "Confirm & Sign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
