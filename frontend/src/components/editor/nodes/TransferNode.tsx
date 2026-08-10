"use client"

import React, { useEffect } from "react"
import { useReactFlow } from "reactflow"
import { ArrowLeftRight } from "lucide-react"
import AssetSelector from "../AssetSelector"
import NodeShell from "./NodeShell"
import type { NodeData } from "./NodeShell"
import type { TransferAsset } from "@/lib/compile/schema"
import { getNativeXlmAsset } from "@/lib/stellar/tokenMetadata"

interface TransferNodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

function assetBadgeLabel(asset: TransferAsset | undefined): string | null {
  if (!asset) return null
  if (asset.kind === "xlm") return asset.symbol ?? "XLM"
  return asset.symbol ?? null
}

export default function TransferNode({ id, data, selected }: TransferNodeProps) {
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

  const handleAssetChange = (asset: TransferAsset) => {
    updateParams({ asset, token: asset.contractId })
  }

  // Default Transfer asset to XLM when the panel opens and nothing is stored yet
  useEffect(() => {
    if (!selected) return
    if (data.params?.asset) return
    const xlm = getNativeXlmAsset()
    updateParams({ asset: xlm, token: xlm.contractId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed once when panel opens empty
  }, [selected, data.params?.asset])

  const transferBadge = assetBadgeLabel(data.params?.asset as TransferAsset | undefined)

  return (
    <NodeShell
      id={id}
      type="Transfer"
      data={data}
      selected={selected}
      icon={ArrowLeftRight}
      badge={transferBadge ? `${transferBadge}` : "Transfer"}
      accentBg="bg-emerald-50 dark:bg-emerald-950/40"
      accentBorder="border-emerald-300 dark:border-emerald-700/60"
      accentText="text-emerald-900 dark:text-emerald-200"
      accentBadge="bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Asset
      </p>
      <AssetSelector
        value={data.params?.asset as TransferAsset | undefined ?? getNativeXlmAsset()}
        onChange={handleAssetChange}
      />
    </NodeShell>
  )
}