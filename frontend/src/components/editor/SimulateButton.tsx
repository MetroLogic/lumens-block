"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import type { Node, Edge } from "reactflow"
import { simulateContract, inferArgsFromGraph, type SimulateArg, type SimulateResult } from "@/lib/stellar/simulate"
import { useToast } from "@/components/toast/ToastProvider"
import SimulateModal from "./SimulateModal"

interface Props {
  nodes: Node[]
  edges: Edge[]
}

export default function SimulateButton({ nodes, edges }: Props) {
  const toast = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [args, setArgs] = useState<SimulateArg[]>([])
  const [status, setStatus] = useState<"idle" | "simulating" | "success" | "error">("idle")
  const [result, setResult] = useState<SimulateResult | null>(null)

  const handleOpen = () => {
    // Re-infer args from the current graph each time the modal opens
    setArgs(inferArgsFromGraph({ nodes, edges }))
    setStatus("idle")
    setResult(null)
    setIsOpen(true)
  }

  const handleSimulate = async () => {
    setStatus("simulating")
    setResult(null)
    try {
      const res = await simulateContract({ graph: { nodes, edges }, args })
      setResult(res)
      setStatus(res.success ? "success" : "error")
      if (res.success) {
        toast.success({ title: "Simulation succeeded", description: "The contract dry run completed." })
      } else {
        toast.error({ title: "Simulation failed", description: res.error ?? res.errorCode ?? "Review the simulation output." })
      }
    } catch (err) {
      const description = err instanceof Error ? err.message : String(err)
      setResult({
        success: false,
        events: [],
        resources: { instructions: 0, readBytes: 0, writeBytes: 0, readEntries: 0, writeEntries: 0, memBytes: 0 },
        error: description,
      })
      setStatus("error")
      toast.error({ title: "Simulation failed", description })
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-violet-700 transition-colors"
        aria-label="Simulate contract"
        title="Simulate contract without submitting to chain"
      >
        <FlaskConical size={15} />
        Simulate
      </button>

      <SimulateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        args={args}
        onArgsChange={setArgs}
        onSimulate={handleSimulate}
        status={status}
        result={result}
      />
    </>
  )
}
