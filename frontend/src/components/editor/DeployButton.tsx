"use client"

import { useState } from "react"
import type { Node, Edge } from "reactflow"
import { deployContract } from "@/lib/stellar/deploy"

interface Props {
  nodes: Node[]
  edges: Edge[]
}

export default function DeployButton({ nodes, edges }: Props) {
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")

  const handleDeploy = async () => {
    setStatus("deploying")
    try {
      await deployContract({ nodes, edges })
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  const labels = {
    idle: "Deploy Contract",
    deploying: "Deploying...",
    success: "Deployed ✓",
    error: "Failed — Retry",
  }

  return (
    <button
      onClick={handleDeploy}
      disabled={status === "deploying"}
      className="absolute bottom-6 right-6 z-10 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
    >
      {labels[status]}
    </button>
  )
}
