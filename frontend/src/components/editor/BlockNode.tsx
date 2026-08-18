"use client"

import React, { useEffect } from "react"
import { Handle, Position, useReactFlow } from "reactflow"
import ConditionExpressionBuilder from "./ConditionExpressionBuilder"
import AssetSelector from "./AssetSelector"
import type {
  ConditionExpression,
  FunctionParamConfig,
  FunctionVisibility,
  TransferAsset,
} from "@/lib/compile/schema"
import { FUNCTION_VISIBILITIES, MAX_FUNCTION_PARAMS } from "@/lib/compile/schema"
import { getNativeXlmAsset } from "@/lib/stellar/tokenMetadata"

// ---------------------------------------------------------------------------
// Type augmentation: allow BlockNode to receive any data shape
// ---------------------------------------------------------------------------

interface NodeData {
  label: string
  params?: {
    condition?: string
    conditionExpression?: ConditionExpression
    storageKey?: string
    token?: string
    asset?: TransferAsset
    eventName?: string
    functionName?: string
    visibility?: FunctionVisibility
    functionParams?: FunctionParamConfig[]
    returnType?: string
    returnValue?: string
  }
}

interface BlockNodeProps {
  id: string
  type: string
  data: NodeData
  selected?: boolean
}

/** Short badge text shown in a node's header. */
const BADGE_LABELS: Record<string, string> = {
  default: "Start",
  FunctionEntry: "Function",
  FunctionReturn: "Return",
}

const inputClasses =
  "w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

function assetBadgeLabel(asset: TransferAsset | undefined): string | null {
  if (!asset) return null
  if (asset.kind === "xlm") return asset.symbol ?? "XLM"
  return asset.symbol ?? null
}

export default function BlockNode({ id, type, data, selected }: BlockNodeProps) {
  const { setNodes } = useReactFlow()

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
    case "FunctionEntry":
      colorClasses =
        "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-700/60 dark:text-indigo-200 dark:shadow-none"
      badgeColor = "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
      panelBorder =
        "border-indigo-200 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/50"
      break
    case "FunctionReturn":
      colorClasses =
        "bg-teal-50 border-teal-300 text-teal-900 shadow-teal-100 dark:bg-teal-950/40 dark:border-teal-700/60 dark:text-teal-200 dark:shadow-none"
      badgeColor = "bg-teal-200/60 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200"
      panelBorder = "border-teal-200 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/50"
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

  const functionParams = data.params?.functionParams ?? []

  const setFunctionParams = (next: FunctionParamConfig[]) => {
    updateParams({ functionParams: next })
  }

  const addFunctionParam = () => {
    if (functionParams.length >= MAX_FUNCTION_PARAMS) return
    setFunctionParams([...functionParams, { name: "", rustType: "" }])
  }

  const updateFunctionParam = (index: number, patch: Partial<FunctionParamConfig>) => {
    setFunctionParams(functionParams.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const removeFunctionParam = (index: number) => {
    setFunctionParams(functionParams.filter((_, i) => i !== index))
  }

  const handleExpressionChange = (expr: ConditionExpression) => {
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
          {BADGE_LABELS[type] ?? type}
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
      {/* FunctionEntry config panel — only visible when node is selected      */}
      {/* ------------------------------------------------------------------ */}
      {type === "FunctionEntry" && selected && (
        <div
          data-testid="function-entry-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[260px] ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Function Signature
          </p>

          <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Name
          </label>
          <input
            data-testid="function-name-input"
            value={data.params?.functionName ?? ""}
            placeholder="deposit"
            onChange={(e) => updateParams({ functionName: e.target.value })}
            className={inputClasses}
          />

          <label className="mt-2 block text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Visibility
          </label>
          <select
            data-testid="function-visibility-select"
            value={data.params?.visibility ?? "pub"}
            onChange={(e) => updateParams({ visibility: e.target.value as FunctionVisibility })}
            className={inputClasses}
          >
            {FUNCTION_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
              Parameters ({functionParams.length}/{MAX_FUNCTION_PARAMS})
            </span>
            <button
              data-testid="function-param-add"
              disabled={functionParams.length >= MAX_FUNCTION_PARAMS}
              onClick={addFunctionParam}
              className="rounded border border-indigo-300 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 disabled:opacity-40 dark:border-indigo-700 dark:text-indigo-300"
            >
              + Add
            </button>
          </div>

          {functionParams.map((param, index) => (
            <div key={index} className="mt-1.5 flex items-center gap-1">
              <input
                data-testid={`function-param-name-${index}`}
                value={param.name}
                placeholder="amount"
                onChange={(e) => updateFunctionParam(index, { name: e.target.value })}
                className={inputClasses}
              />
              <input
                data-testid={`function-param-type-${index}`}
                value={param.rustType}
                placeholder="i128"
                onChange={(e) => updateFunctionParam(index, { rustType: e.target.value })}
                className={inputClasses}
              />
              <button
                data-testid={`function-param-remove-${index}`}
                onClick={() => removeFunctionParam(index)}
                aria-label={`Remove parameter ${index + 1}`}
                className="rounded px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
          ))}

          <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            `env: Env` is always the first argument and does not need declaring.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FunctionReturn config panel — only visible when node is selected     */}
      {/* ------------------------------------------------------------------ */}
      {type === "FunctionReturn" && selected && (
        <div
          data-testid="function-return-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[240px] ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Return
          </p>

          <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Type
          </label>
          <input
            data-testid="function-return-type-input"
            value={data.params?.returnType ?? ""}
            placeholder="()"
            onChange={(e) => updateParams({ returnType: e.target.value })}
            className={inputClasses}
          />

          <label className="mt-2 block text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Value
          </label>
          <input
            data-testid="function-return-value-input"
            value={data.params?.returnValue ?? ""}
            placeholder="amount"
            onChange={(e) => updateParams({ returnValue: e.target.value })}
            className={inputClasses}
          />
          <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Leave the value empty to emit a zero value for the declared type.
          </p>
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
