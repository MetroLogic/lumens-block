"use client"

import { useState } from "react"
import type { Node, Edge } from "reactflow"
import { deployContract } from "@/lib/stellar/deploy"
import { useWallet } from "@/components/wallet/WalletContext"

interface Props {
  nodes: Node[]
  edges: Edge[]
}

export default function DeployButton({ nodes, edges }: Props) {
  const { publicKey } = useWallet()
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")

  const handleDeploy = async () => {
    if (!publicKey) return

    setStatus("deploying")
    try {
      await deployContract({ nodes, edges }, publicKey)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  const labels = {
    idle: publicKey ? "Deploy Contract" : "Connect Wallet to Deploy",
    deploying: "Deploying…",
    success: "Deployed ✓",
    error: "Failed — Retry",
  }

  return (
    <button
      id="deploy-contract-button"
      onClick={handleDeploy}
      disabled={status === "deploying" || !publicKey}
      title={!publicKey ? "Connect your Freighter wallet first" : undefined}
      className="absolute bottom-6 right-6 z-10 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {labels[status]}
    </button>
  )
}
