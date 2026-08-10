"use client"

import React, { useEffect } from "react"
import { useReactFlow } from "reactflow"
import { GitBranch } from "lucide-react"
import ConditionExpressionBuilder from "../ConditionExpressionBuilder"
import NodeShell from "./NodeShell"
import type { NodeData } from "./NodeShell"
import type { ConditionExpression } from "@/lib/compile/schema"

interface ConditionNodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

export default function ConditionNode({ id, data, selected }: ConditionNodeProps) {
  const { setNodes } = useReactFlow()

  const updateParams = (patch: Partial<NodeData["params"]>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n
        return {
          ...n,
          data: {
            ...n.data,
            params: { ...(n.data.params ?? {}), ...patch },
          },
        }
      })
    )
  }

  const handleExpressionChange = (expr: ConditionExpression) => {
    updateParams({ conditionExpression: expr })
  }

  return (
    <NodeShell
      id={id}
      type="Condition"
      data={data}
      selected={selected}
      icon={GitBranch}
      badge="Condition"
      accentBg="bg-rose-50 dark:bg-rose-950/40"
      accentBorder="border-rose-300 dark:border-rose-700/60"
      accentText="text-rose-900 dark:text-rose-200"
      accentBadge="bg-rose-200/60 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        Condition Expression
      </p>
      <ConditionExpressionBuilder
        value={data.params?.conditionExpression as ConditionExpression | undefined}
        onChange={handleExpressionChange}
      />
    </NodeShell>
  )
}