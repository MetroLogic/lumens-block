"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Edge, Node } from "reactflow"
import {
  CompileContractError,
  deployContract,
  estimateDeploymentFee,
  type DeploymentResult,
  type StellarNetwork,
} from "@/lib/stellar/deploy"

interface Props {
  nodes: Node[]
  edges: Edge[]
  disabled?: boolean
  selectedNetwork: StellarNetwork
  walletAddress: string | null
  walletBalance: string
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
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false)

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

  useEffect(() => {
    setMainnetConfirmed(false)
  }, [selectedNetwork])

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
  const needsMainnetConfirmation = selectedNetwork === "mainnet"
  const canConfirmDeployment =
    Boolean(walletAddress) &&
    Boolean(estimatedFee) &&
    hasEnoughBalance &&
    status !== "deploying" &&
    (!needsMainnetConfirmation || mainnetConfirmed)

  const closeConfirm = () => {
    setIsConfirmOpen(false)
    setMainnetConfirmed(false)
  }

  const handleDeploy = async () => {
    if (!walletAddress) {
      setMessage("Connect your wallet before deploying.")
      return
    }

    setStatus("deploying")
    setMessage(null)
    setDeploymentResult(null)

    try {
      const result = await deployContract({ nodes, edges }, selectedNetwork)
      setStatus("success")
      setDeploymentResult(result)
      setMessage("Contract deployed successfully.")
      closeConfirm()
    } catch (err) {
      setStatus("error")
      setDeploymentResult(null)
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
    deploying: "Deploying...",
    success: "Deployed",
    error: "Failed - Retry",
  }

  return (
    <>
      {message && (
        <div
          role="status"
          className={`w-full rounded-lg px-3 py-2 text-xs shadow ${
            status === "error"
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <p>{message}</p>
          {deploymentResult && (
            <div className="mt-2 space-y-1 break-all">
              <p>
                Contract ID:{" "}
                <a
                  href={deploymentResult.contractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  {deploymentResult.contractId}
                </a>
              </p>
              <p>WASM hash: {deploymentResult.wasmHash}</p>
              <p>Upload tx: {deploymentResult.uploadTransactionHash}</p>
              <p>Create tx: {deploymentResult.createTransactionHash}</p>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={status === "deploying" || disabled}
        title={disabled ? "Fix failing tests or enable override to deploy" : undefined}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {labels[status]}
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Confirm deployment</h3>
              <button onClick={closeConfirm} className="text-sm text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Network</span>
                <span className="font-medium capitalize text-slate-900">{selectedNetwork}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Estimated fee</span>
                <span className="font-medium text-slate-900">
                  {isEstimating ? "Estimating..." : estimatedFee ? `${estimatedFee} XLM` : "-"}
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

            {needsMainnetConfirmation && (
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={mainnetConfirmed}
                  onChange={(event) => setMainnetConfirmed(event.target.checked)}
                  className="mt-1"
                />
                <span>I understand this will deploy to Mainnet and spend real XLM.</span>
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeConfirm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeploy()}
                disabled={!canConfirmDeployment}
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
