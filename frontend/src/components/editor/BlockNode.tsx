"use client"

import React, { useEffect, useMemo } from "react"
import { Handle, Position, useNodes, useReactFlow } from "reactflow"
import { Repeat } from "lucide-react"
import ConditionExpressionBuilder from "./ConditionExpressionBuilder"
import AssetSelector from "./AssetSelector"
import CrossContractCallConfig from "./CrossContractCallConfig"
import { Shield } from "lucide-react"
import type {
  BlockParameters,
  FunctionParamConfig,
  FunctionVisibility,
  RbacAction,
  RbacRole,
  LoopConfig,
  LoopMode,
  TransferAsset,
} from "@/lib/compile/schema"
import {
  DEFAULT_LOOP_CONFIG,
  FUNCTION_VISIBILITIES,
  LOOP_BODY_HANDLE,
  LOOP_ITEMS_HANDLE,
  LOOP_RESULT_HANDLE,
  MAX_FUNCTION_PARAMS,
  MAX_LOOP_ITERATIONS,
  MIN_LOOP_ITERATIONS,
} from "@/lib/compile/schema"
import { sanitizeRustIdent } from "@/lib/compile/crossContract"
import { getNativeXlmAsset } from "@/lib/stellar/tokenMetadata"

// ---------------------------------------------------------------------------
// Type augmentation: allow BlockNode to receive any data shape
// ---------------------------------------------------------------------------

interface NodeData {
  label: string
  params?: BlockParameters
  /** Set by BlockEditor when this node participates in a control-flow cycle. */
  hasCycleError?: boolean
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
  RBACCheck: "RBAC",
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
    case "RBACCheck":
      colorClasses =
        "bg-red-50 border-red-500 text-red-900 shadow-red-100 dark:bg-red-950/40 dark:border-red-600 dark:text-red-200 dark:shadow-none"
      badgeColor = "bg-red-200/80 text-red-800 dark:bg-red-900/80 dark:text-red-200"
      panelBorder =
        "border-red-200 bg-red-50/80 dark:border-red-800 dark:bg-red-950/50"
      break
    case "CrossContractCall":
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
    case "Loop":
      colorClasses =
        "bg-orange-50 border-orange-300 text-orange-900 shadow-orange-100 dark:bg-orange-950/40 dark:border-orange-700/60 dark:text-orange-200 dark:shadow-none"
      badgeColor = "bg-orange-200/60 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200"
      panelBorder =
        "border-orange-200 bg-orange-50/80 dark:border-orange-800 dark:bg-orange-950/50"
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

  const handleExpressionChange = (expr: NonNullable<BlockParameters["conditionExpression"]>) => {
    updateParams({ conditionExpression: expr })
  }

  const handleAssetChange = (asset: TransferAsset) => {
    updateParams({
      asset,
      token: asset.contractId,
    })
  }

  const loopConfig: LoopConfig = {
    ...DEFAULT_LOOP_CONFIG,
    ...(data.params?.loop ?? {}),
  }

  const updateLoop = (patch: Partial<LoopConfig>) => {
    updateParams({ loop: { ...loopConfig, ...patch } })
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
  const loopBadge =
    type === "Loop"
      ? `${loopConfig.mode} · max ${loopConfig.maxIterations}`
      : null

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      data-testid={`block-node-${type}`}
      data-error={data.hasCycleError ? "cycle" : undefined}
      className={`relative rounded-xl border-2 shadow-sm font-sans min-w-[180px] ${
        selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
      } ${
        data.hasCycleError
          ? "border-red-500 ring-2 ring-red-500 bg-red-50 text-red-900 dark:border-red-500 dark:ring-red-500 dark:bg-red-950/50 dark:text-red-200"
          : colorClasses
      }`}
    >
      {type === "Loop" ? (
        <>
          <Handle
            type="target"
            id={LOOP_ITEMS_HANDLE}
            position={Position.Top}
            data-testid="loop-handle-items"
            title="items"
            className="!bg-orange-400 !w-2.5 !h-2.5 hover:!bg-orange-600 transition-colors"
          />
          <Handle
            type="source"
            id={LOOP_BODY_HANDLE}
            position={Position.Right}
            data-testid="loop-handle-body"
            title="body"
            className="!bg-orange-500 !w-3 !h-3 hover:!bg-orange-700 transition-colors"
          />
          <span className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            body
          </span>
        </>
      ) : (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
        />
      )}

      {/* Node header */}
      <div className="flex flex-col items-center gap-1 px-4 py-3 text-center">
        <div className="flex items-center gap-1">
          {type === "RBACCheck" && <Shield size={12} className="text-red-600 dark:text-red-400" />}
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}
          >
            {BADGE_LABELS[type] ?? type}
          </span>
        </div>
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
        {loopBadge && (
          <span
            className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}
            title={`Loop ${loopBadge}`}
          >
            <Repeat size={10} aria-hidden="true" />
            {loopBadge}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RBACCheck config panel — only visible when node is selected         */}
      {/* ------------------------------------------------------------------ */}
      {type === "RBACCheck" && selected && (
        <div
          data-testid="config-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[220px] ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            RBAC Config
          </p>

          {/* Role selection */}
          <div className="mb-2">
            <label className="block text-[10px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Role
            </label>
            <select
              data-testid="rbac-role-select"
              value={data.params?.rbacRole ?? "admin"}
              onChange={(e) => updateParams({ rbacRole: e.target.value as RbacRole })}
              className={inputClasses}
            >
              <option value="admin">admin</option>
              <option value="minter">minter</option>
              <option value="pauser">pauser</option>
              <option value="custom">custom</option>
            </select>
          </div>

          {/* Custom role input */}
          {(data.params?.rbacRole ?? "admin") === "custom" && (
            <div className="mb-2">
              <label className="block text-[10px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Custom Role Name
              </label>
              <input
                data-testid="rbac-custom-role-input"
                type="text"
                value={data.params?.rbacCustomRole ?? ""}
                onChange={(e) => updateParams({ rbacCustomRole: e.target.value })}
                placeholder="e.g. operator"
                className={`${inputClasses} ${
                  !(data.params?.rbacCustomRole ?? "").trim() ? "border-red-500 ring-1 ring-red-500" : ""
                }`}
              />
              {!(data.params?.rbacCustomRole ?? "").trim() && (
                <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                  Custom role name is required.
                </p>
              )}
            </div>
          )}

          {/* Action radio group */}
          <div>
            <label className="block text-[10px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Action
            </label>
            <div className="flex flex-col gap-1 text-xs text-slate-800 dark:text-slate-200">
              {(["require", "grant", "revoke", "transfer_admin"] as const).map((act) => (
                <label key={act} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`rbac-action-${id}`}
                    value={act}
                    checked={(data.params?.rbacAction ?? "require") === act}
                    onChange={() => updateParams({ rbacAction: act })}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{act}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* ------------------------------------------------------------------ */}
      {/* Loop config panel — only visible when node is selected               */}
      {/* ------------------------------------------------------------------ */}
      {type === "Loop" && selected && (
        <div
          data-testid="config-panel"
          className={`border-t-2 rounded-b-xl px-3 py-3 min-w-[230px] ${panelBorder}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
            <Repeat size={12} aria-hidden="true" />
            Loop Config
          </p>

          <div className="mb-2">
            <label className="block text-[10px] font-medium text-orange-800 dark:text-orange-200 mb-1">
              Loop mode
            </label>
            <div className="flex rounded overflow-hidden border border-orange-300 dark:border-orange-700 text-[11px] font-semibold">
              {(["range", "vec"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`loop-mode-${mode}`}
                  className={`flex-1 py-1 transition-colors ${
                    loopConfig.mode === mode
                      ? "bg-orange-400 text-white dark:bg-orange-600"
                      : "bg-white text-orange-700 dark:bg-orange-950 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900"
                  }`}
                  onClick={() => updateLoop({ mode: mode as LoopMode })}
                >
                  {mode === "range" ? "Range" : "Vec"}
                </button>
              ))}
            </div>
          </div>

          {loopConfig.mode === "range" ? (
            <p className="mb-2 text-[10px] leading-snug text-orange-700/80 dark:text-orange-300/80">
              Iterates <span className="font-mono">start..end</span> (function params), capped by max iterations.
            </p>
          ) : (
            <p className="mb-2 text-[10px] leading-snug text-orange-700/80 dark:text-orange-300/80">
              Iterates the <span className="font-mono">Vec&lt;i128&gt;</span> connected to the items port, capped by max iterations.
            </p>
          )}

          <div className="mb-2">
            <label className="block text-[10px] font-medium text-orange-800 dark:text-orange-200 mb-1">
              Max iterations
            </label>
            <input
              data-testid="loop-max-iterations"
              type="number"
              min={MIN_LOOP_ITERATIONS}
              max={MAX_LOOP_ITERATIONS}
              value={loopConfig.maxIterations}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10)
                updateLoop({
                  maxIterations: Number.isFinite(parsed) ? parsed : loopConfig.maxIterations,
                })
              }}
              className="w-full rounded border border-orange-300 dark:border-orange-700 bg-white dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-xs px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-orange-800 dark:text-orange-200 mb-1">
              Iterator variable
            </label>
            <input
              data-testid="loop-iterator-var"
              type="text"
              value={loopConfig.iteratorVar}
              onChange={(e) => updateLoop({ iteratorVar: e.target.value })}
              placeholder="i"
              className="w-full rounded border border-orange-300 dark:border-orange-700 bg-white dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 font-mono"
            />
          </div>
        </div>
      )}

      {/* Source handle on bottom */}
      <Handle
        type="source"
        id={type === "Loop" ? LOOP_RESULT_HANDLE : undefined}
        position={Position.Bottom}
        data-testid={type === "Loop" ? "loop-handle-result" : undefined}
        className="!bg-gray-400 !w-2.5 !h-2.5 hover:!bg-blue-500 transition-colors"
      />
    </div>
  )
}
