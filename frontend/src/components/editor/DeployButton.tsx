"use client"

import { useState } from "react"
import type { Node, Edge } from "reactflow"
import { CompileContractError, deployContract } from "@/lib/stellar/deploy"

interface Props {
  nodes: Node[]
  edges: Edge[]
}

export default function DeployButton({ nodes, edges }: Props) {
  const [status, setStatus] = useState<"idle" | "deploying" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const handleDeploy = async () => {
    setStatus("deploying")
    setMessage(null)

    try {
      const result = await deployContract({ nodes, edges })
      setStatus("success")
      setMessage(result)
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
    <div className="absolute bottom-6 right-6 z-10 flex max-w-sm flex-col items-end gap-2">
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
        onClick={handleDeploy}
        disabled={status === "deploying"}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
      >
        {labels[status]}
      </button>
    </div>
  )
}
