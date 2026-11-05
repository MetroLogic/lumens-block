"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Node, Edge } from "reactflow"
import { Cpu, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { CompileContractError, deployContract, estimateDeploymentFee, type StellarNetwork } from "@/lib/stellar/deploy"
import { useAsyncCompile, type CompileStage } from "@/lib/stellar/useAsyncCompile"
import { loadDeployedSnapshot, saveDeployedSnapshot, toContractGraph } from "@/lib/editor/graphPersistence"
import { diffGraphs, type BreakingChange } from "@/lib/editor/graphDiff"
import { compileGraph } from "@/lib/compiler"

// ─── CompileProgressBar ───────────────────────────────────────────────────────

function CompileProgressBar({
  stage,
  progressLabel,
}: {
  stage: CompileStage
  progressLabel: string
}) {
  if (stage === "idle") return null

  const icon =
    stage === "done" ? (
      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
    ) : stage === "error" ? (
      <AlertCircle size={13} className="text-red-500 shrink-0" />
    ) : stage === "building" ? (
      <Cpu size={13} className="text-violet-400 shrink-0 animate-pulse" />
    ) : (
      <Clock size={13} className="text-amber-400 shrink-0" />
    )

  const barColor =
    stage === "done"
      ? "bg-emerald-400"
      : stage === "error"
      ? "bg-red-400"
      : stage === "building"
      ? "bg-violet-400"
      : "bg-amber-400"

  const isAnimating = stage === "queued" || stage === "building"

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{progressLabel || "Compiling…"}</span>
        </div>
        {progressLabel === "⚡ Cached" && (
          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            ⚡ Cached
          </span>
        )}
      </div>
      <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-1 rounded-full transition-all ${barColor} ${
            isAnimating ? "animate-pulse w-2/3" : "w-full"
          }`}
        />
      </div>
    </div>
  )
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  disabled?: boolean
  selectedNetwork: StellarNetwork
  walletAddress: string | null
  walletBalance: string
  onDeploySuccess?: (contractId: string) => void
}

export default function DeployButton({
  nodes,
  edges,
  disabled = false,
  selectedNetwork,
  walletAddress,
  walletBalance,
  onDeploySuccess,
}: Props) {
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  // ── Graph diff / breaking-change gate ──────────────────────────────────────
  const [isBreakingChangeOpen, setIsBreakingChangeOpen] = useState(false)
  const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([])
  const [redeployConfirm, setRedeployConfirm] = useState("")
  const [nonBreakingNotice, setNonBreakingNotice] = useState<string | null>(null)

  // ── Async compile progress ──────────────────────────────────────────────────
  const { state: compileState, startCompile, reset: resetCompile } = useAsyncCompile({
    onDone: () => {
      // The actual deploy still goes through deployContract (which handles
      // signing). The async compile stream is purely for showing progress;
      // no action needed here — the deploy flow takes over.
    },
    onError: (code, msg) => {
      setStatus("error")
      setMessage(`Compilation error (${code}): ${msg}`)
    },
  })

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

  const closeBreakingChangeModal = () => {
    setIsBreakingChangeOpen(false)
    setRedeployConfirm("")
  }

  /**
   * Entry point for the Deploy button: diffs the canvas against the last
   * deployed snapshot before any deployment flow starts.
   *
   * - Breaking changes → REDEPLOY-gated modal.
   * - Non-breaking changes (added nodes/edges) → informational, never blocks.
   * - No snapshot (first deploy) → straight to the confirmation modal.
   */
  const handleDeployClick = () => {
    setMessage(null)

    const snapshot = loadDeployedSnapshot()
    const diff = diffGraphs(snapshot, toContractGraph(nodes, edges))

    if (diff.hasBreakingChanges) {
      setBreakingChanges(diff.breakingChanges)
      setRedeployConfirm("")
      setIsBreakingChangeOpen(true)
      return
    }

    const informational: string[] = []
    if (diff.addedNodes.length > 0) informational.push(`${diff.addedNodes.length} block(s) added.`)
    if (diff.addedEdges.length > 0) informational.push(`${diff.addedEdges.length} connection(s) added.`)
    if (diff.removedEdges.length > 0) informational.push(`${diff.removedEdges.length} connection(s) removed.`)
    if (diff.modifiedNodes.length > 0) informational.push(`${diff.modifiedNodes.length} block(s) modified.`)
    setNonBreakingNotice(informational.length > 0 ? informational.join(" ") : null)

    setIsConfirmOpen(true)
  }

  const handleDeploy = async () => {
    if (!walletAddress) {
      setMessage("Connect your wallet before deploying.")
      return
    }

    setStatus("deploying")
    setMessage(null)
    resetCompile()

    // Kick off async compile progress stream so the user sees live feedback
    // while deployContract runs its own internal compile step.
    try {
      const graph = toContractGraph(nodes, edges)
      const source = compileGraph(graph)
      void startCompile(source)
    } catch {
      // If source gen fails, deployContract will surface the real error below.
    }

    try {
      const result = await deployContract({ nodes, edges }, selectedNetwork, (stage) => {
        setMessage(stage)
      })
      setStatus("success")
      setMessage(result)
      setIsConfirmOpen(false)
      // Persist the snapshot of what was just deployed so future redeploys can
      // be diffed against it.
      saveDeployedSnapshot(toContractGraph(nodes, edges))

      // Extract the contract ID from the success message and notify the parent
      const idMatch = result.match(/Contract ID:\s*(\S+)/)
      if (idMatch && onDeploySuccess) {
        onDeploySuccess(idMatch[1])
      }
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
        onClick={handleDeployClick}
        disabled={status === "deploying" || disabled}
        data-testid="deploy-button"
        title={disabled ? "Fix failing tests or enable override to deploy" : undefined}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {labels[status]}
      </button>

      {/* Breaking-change gate — shown before redeploying a diverged contract */}
      {isBreakingChangeOpen && (
        <div
          data-testid="breaking-change-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Breaking changes detected</h3>
              <button
                onClick={closeBreakingChangeModal}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Redeploying creates a brand-new contract address — existing on-chain state and dApp
              integrations pointing at the old address will break. Review the changes below:
            </p>

            <ul className="mt-3 space-y-2">
              {breakingChanges.map((change, index) => (
                <li
                  key={index}
                  data-testid="breaking-change-item"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {change.description}
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <label
                htmlFor="redeploy-confirm-input"
                className="block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Type <span className="font-mono font-bold">REDEPLOY</span> to confirm
              </label>
              <input
                id="redeploy-confirm-input"
                data-testid="redeploy-confirm-input"
                value={redeployConfirm}
                onChange={(event) => setRedeployConfirm(event.target.value)}
                placeholder="REDEPLOY"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeBreakingChangeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                data-testid="redeploy-confirm-button"
                onClick={() => {
                  closeBreakingChangeModal()
                  setIsConfirmOpen(true)
                }}
                disabled={redeployConfirm !== "REDEPLOY"}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-red-300 dark:disabled:bg-red-900/50"
              >
                Redeploy
              </button>
            </div>
          </div>
        </div>
      )}

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
              {nonBreakingNotice && (
                <div
                  data-testid="non-breaking-notice"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {nonBreakingNotice}
                </div>
              )}
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

            {/* Live compile progress — shown while deploying */}
            {status === "deploying" && (
              <CompileProgressBar
                stage={compileState.stage}
                progressLabel={compileState.progressLabel}
              />
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
