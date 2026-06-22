"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Node, Edge } from "reactflow"
import { CompileContractError, deployContract, estimateDeploymentFee, type StellarNetwork } from "@/lib/stellar/deploy"

interface Props {
  nodes: Node[]
  edges: Edge[]
  disabled?: boolean
  selectedNetwork: StellarNetwork
  walletAddress: string | null
  walletBalance: string
  disabledReason?: string
}

export default function DeployButton({
  nodes,
  edges,
  disabled = false,
  selectedNetwork,
  walletAddress,
  walletBalance,
  disabledReason,
}: Props) {
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
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
      const result = await deployContract({ nodes, edges }, selectedNetwork)
      setStatus("success")
      setMessage(result)
      setIsConfirmOpen(false)
    } catch (err) {
      setStatus("error")
      if (err instanceof CompileContractError) {
        setMessage(err.message)
      } else if (err instanceof Error) {
        setMessage(err.message)
      } else {
        setMessage("Deployment failed. Please try again.")
      }
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
      {message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs shadow ${
            status === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message}
        </p>
      )}
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={status === "deploying" || disabled}
        title={disabled ? disabledReason ?? "Fix blocking issues before deploying" : undefined}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {labels[status]}
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Confirm deployment</h3>
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Estimated fee</span>
                <span className="font-medium text-slate-900">
                  {isEstimating ? "Estimating..." : estimatedFee ? `${estimatedFee} XLM` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Wallet balance</span>
                <span className="font-medium text-slate-900">{walletBalance} XLM</span>
              </div>
            </div>

            {estimateError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estimateError}</p>
            )}

            {shortfall !== null && shortfall > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Insufficient balance. You are short by {shortfall.toFixed(7)} XLM.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeploy()}
                disabled={!walletAddress || !estimatedFee || !hasEnoughBalance || status === "deploying"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
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
