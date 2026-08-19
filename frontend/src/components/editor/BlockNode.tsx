"use client"

import React, { useEffect, useMemo } from "react"
import { Handle, Position, useNodes, useReactFlow } from "reactflow"
import ConditionExpressionBuilder from "./ConditionExpressionBuilder"
import AssetSelector from "./AssetSelector"
import CrossContractCallConfig from "./CrossContractCallConfig"
import type { BlockParameters, TransferAsset } from "@/lib/compile/schema"
import { sanitizeRustIdent } from "@/lib/compile/crossContract"
import { getNativeXlmAsset } from "@/lib/stellar/tokenMetadata"

// ---------------------------------------------------------------------------
// Type augmentation: allow BlockNode to receive any data shape
// ---------------------------------------------------------------------------

interface NodeData {
  label: string
  params?: BlockParameters
}

interface BlockNodeProps {
  id: string
  type: string
  data: NodeData
  selected?: boolean
}

function assetBadgeLabel(asset: TransferAsset | undefined): string | null {
  if (!asset) return null
  if (asset.kind === "xlm") return asset.symbol ?? "XLM"
  return asset.symbol ?? null
}

export default function BlockNode({ id, type, data, selected }: BlockNodeProps) {
  const { setNodes } = useReactFlow()
  const allNodes = useNodes()

  // Return values bound by CrossContractCall blocks are referenceable as
  // operands inside downstream Condition blocks.
  const returnBindings = useMemo(
    () =>
      allNodes
        .filter((node) => node.type === "CrossContractCall")
        .map((node) => (node.data as NodeData)?.params?.returnBinding?.trim())
        .filter((binding): binding is string => Boolean(binding))
        .map((binding) => sanitizeRustIdent(binding, "call_result")),
    [allNodes]
  )

  // -------------------------------------------------------------------------
  // Color scheme per block type
  // -------------------------------------------------------------------------
  let colorClasses = "bg-white border-gray-300 text-gray-800"
  let badgeColor = "bg-gray-100 text-gray-600"
  let panelBorder = "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60"

  switch (type) {
    case "Condition":
      colorClasses =
        "bg-rose-50 border-rose-300 text-rose-900 shadow-rose-100 dark:bg-rose-950/40 dark:border-rose-700/60 dark:text-rose-200 dark:shadow-none"
      badgeColor = "bg-rose-200/60 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
      panelBorder =
        "border-rose-200 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/50"
      break
    case "Transfer":
      colorClasses =
        "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700/60 dark:text-emerald-200 dark:shadow-none"
      badgeColor = "bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
      panelBorder =
        "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/50"
      break
    case "Storage":
      colorClasses =
        "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100 dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-200 dark:shadow-none"
      badgeColor = "bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
      break
    case "Event":
      colorClasses =
        "bg-sky-50 border-sky-300 text-sky-900 shadow-sky-100 dark:bg-sky-950/40 dark:border-sky-700/60 dark:text-sky-200 dark:shadow-none"
      badgeColor = "bg-sky-200/60 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200"
      break
    case "Auth":
      colorClasses =
        "bg-purple-50 border-purple-300 text-purple-900 shadow-purple-100 dark:bg-purple-950/40 dark:border-purple-700/60 dark:text-purple-200 dark:shadow-none"
      badgeColor = "bg-purple-200/60 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
      break
    case "CrossContractCall":
      colorClasses =
        "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-700/60 dark:text-indigo-200 dark:shadow-none"
      badgeColor = "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
      panelBorder =
        "border-indigo-200 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/50"
      break
    case "default":
      colorClasses =
        "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100 dark:bg-blue-950/40 dark:border-blue-700/60 dark:text-blue-200 dark:shadow-none"
      badgeColor = "bg-blue-200/60 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
      break
  }

  // -------------------------------------------------------------------------
  // Update helpers
  // -------------------------------------------------------------------------
  const updateParams = (patch: Partial<NodeData["params"]>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n
        return {
          ...n,
          data: {
            ...n.data,
            params: {
              ...(n.data.params ?? {}),
              ...patch,
            },
          },
        }
      })
    )
  }

  const handleExpressionChange = (expr: NonNullable<BlockParameters["conditionExpression"]>) => {
    updateParams({ conditionExpression: expr })
  }

  const handleAssetChange = (asset: TransferAsset) => {
    updateParams({
      asset,
      token: asset.contractId,
    })
  }

  // Default Transfer asset to XLM when the panel opens and nothing is stored yet
  useEffect(() => {
    if (type !== "Transfer" || !selected) return
    if (data.params?.asset) return
    const xlm = getNativeXlmAsset()
    updateParams({ asset: xlm, token: xlm.contractId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed once when panel opens empty
  }, [type, selected, data.params?.asset])

  const transferBadge = type === "Transfer" ? assetBadgeLabel(data.params?.asset) : null
  const crossContractBadge =
    type === "CrossContractCall" && data.params?.targetFunction
      ? `${data.params.targetFunction}()`
      : null
  const storageBadge =
    type === "Storage"
      ? (data.params?.storageMode ?? "write") === "read" ? "Read" : "Write"
      : null

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      data-testid={`block-node-${type}`}
      className={`relative rounded-xl border-2 shadow-sm font-sans min-w-[180px] ${
        selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
      } ${colorClasses}`}
    >
      {/* Target handle on top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />

      {/* Node header */}
      <div className="flex flex-col items-center gap-1 px-4 py-3 text-center">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}
        >
          {type === "default" ? "Start" : type}
        </span>
        <div className="text-sm font-semibold mt-1">{data.label}</div>
        {transferBadge && (
          <span
            className={`mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}
            title={data.params?.asset?.contractId}
          >
            {transferBadge}
          </span>
        )}
        {storageBadge && (
          <span
            className={`mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}
            title={`Storage mode: ${storageBadge}`}
          >
            {storageBadge}
          </span>
        )}
        {crossContractBadge && (
          <span
            className={`mt-0.5 font-mono text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}
            title={data.params?.targetContractId}
          >
            {crossContractBadge}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Condition config panel — only visible when node is selected          */}
      {/* ------------------------------------------------------------------ */}
      {type === "Condition" && selected && (
        <div
          data-testid="config-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 ${panelBorder}`}
          // Prevent React Flow from interpreting drag/click inside the panel
          // as a node drag, which would move the node unexpectedly.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Condition Expression
          </p>
          <ConditionExpressionBuilder
            value={data.params?.conditionExpression}
            onChange={handleExpressionChange}
            extraArgs={returnBindings}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Transfer asset selector — only visible when node is selected         */}
      {/* ------------------------------------------------------------------ */}
      {type === "Transfer" && selected && (
        <div
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[240px] ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Asset
          </p>
          <AssetSelector
            value={data.params?.asset ?? getNativeXlmAsset()}
            onChange={handleAssetChange}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Storage config panel — only visible when node is selected           */}
      {/* ------------------------------------------------------------------ */}
      {type === "Storage" && selected && (
        <div
          data-testid="config-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[220px] border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/50`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Storage Config
          </p>
          {/* Mode toggle */}
          <div className="mb-2">
            <label className="block text-[10px] font-medium text-amber-800 dark:text-amber-200 mb-1">Mode</label>
            <div className="flex rounded overflow-hidden border border-amber-300 dark:border-amber-700 text-[11px] font-semibold">
              {(["write", "read"] as const).map((m) => (
                <button
                  key={m}
                  className={`flex-1 py-1 transition-colors ${
                    (data.params?.storageMode ?? "write") === m
                      ? "bg-amber-400 text-white dark:bg-amber-600"
                      : "bg-white text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                  }`}
                  onClick={() => updateParams({ storageMode: m })}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Scope selector */}
          <div className="mb-2">
            <label className="block text-[10px] font-medium text-amber-800 dark:text-amber-200 mb-1">Scope</label>
            <select
              value={data.params?.storageScope ?? "instance"}
              onChange={(e) => updateParams({ storageScope: e.target.value as "instance" | "persistent" | "temporary" })}
              className="w-full rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs px-2 py-1"
            >
              <option value="instance">Instance</option>
              <option value="persistent">Persistent</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
          {/* Storage key */}
          <div className="mb-2">
            <label className="block text-[10px] font-medium text-amber-800 dark:text-amber-200 mb-1">Key</label>
            <input
              type="text"
              value={data.params?.storageKey ?? ""}
              onChange={(e) => updateParams({ storageKey: e.target.value })}
              placeholder="e.g. balance"
              className="w-full rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs px-2 py-1"
            />
          </div>
          {/* Return type — only shown in read mode */}
          {(data.params?.storageMode ?? "write") === "read" && (
            <div>
              <label className="block text-[10px] font-medium text-amber-800 dark:text-amber-200 mb-1">Return Type</label>
              <select
                value={data.params?.storageReturnType ?? "i128"}
                onChange={(e) => updateParams({ storageReturnType: e.target.value as "i128" | "bool" | "Symbol" | "Address" })}
                className="w-full rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs px-2 py-1"
              >
                <option value="i128">i128</option>
                <option value="bool">bool</option>
                <option value="Symbol">Symbol</option>
                <option value="Address">Address</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Cross-contract call config panel — only visible when selected       */}
      {/* ------------------------------------------------------------------ */}
      {type === "CrossContractCall" && selected && (
        <div
          className={`border-t-2 rounded-b-xl px-3 py-3 ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Cross-Contract Call
          </p>
          <CrossContractCallConfig
            value={data.params ?? {}}
            onChange={(patch) => updateParams(patch)}
          />
        </div>
      )}

      {/* Source handle on bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />
    </div>
  )
}
