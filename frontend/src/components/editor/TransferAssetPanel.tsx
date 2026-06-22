"use client"

import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { Node } from "reactflow"
import type { BlockParameters } from "@/lib/compile/schema"
import {
  fetchSacTokenMetadata,
  formatAssetLabel,
  validateTransferAssetSelection,
} from "@/lib/stellar/assets"

interface TransferNodeData {
  label: string
  params?: BlockParameters
}

interface Props {
  selectedNode: Node<TransferNodeData> | null
  onClose: () => void
  onUpdateNode: (nodeId: string, data: TransferNodeData) => void
}

function cleanParams(params: BlockParameters): BlockParameters | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  ) as BlockParameters

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

export default function TransferAssetPanel({ selectedNode, onClose, onUpdateNode }: Props) {
  const [tokenInput, setTokenInput] = useState("")
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle"
  )
  const [metadataError, setMetadataError] = useState<string | null>(null)

  const params = selectedNode?.data.params
  const assetType = params?.assetType ?? "native"
  const validation = useMemo(
    () => validateTransferAssetSelection({ assetType, token: tokenInput }),
    [assetType, tokenInput]
  )

  const commitParams = useCallback((patch: BlockParameters) => {
    if (!selectedNode) return

    const nextParams = cleanParams({
      ...(selectedNode.data.params ?? {}),
      ...patch,
    })

    onUpdateNode(selectedNode.id, {
      ...selectedNode.data,
      ...(nextParams ? { params: nextParams } : { params: undefined }),
    })
  }, [onUpdateNode, selectedNode])

  useEffect(() => {
    setTokenInput(params?.token ?? "")
    setMetadataStatus(params?.assetSymbol || params?.assetName ? "loaded" : "idle")
    setMetadataError(null)
  }, [params?.assetName, params?.assetSymbol, params?.assetType, params?.token, selectedNode?.id])

  useEffect(() => {
    if (!selectedNode || selectedNode.type !== "Transfer" || assetType !== "sac") return

    const token = tokenInput.trim()
    const nextValidation = validateTransferAssetSelection({ assetType: "sac", token })
    if (!nextValidation.ok) return

    if (params?.token === token && (params.assetSymbol || params.assetName)) {
      setMetadataStatus("loaded")
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setMetadataStatus("loading")
      setMetadataError(null)

      try {
        const metadata = await fetchSacTokenMetadata(token)
        if (cancelled) return

        commitParams({
          assetType: "sac",
          token,
          assetSymbol: metadata.symbol,
          assetName: metadata.name,
        })
        setMetadataStatus(metadata.symbol || metadata.name ? "loaded" : "error")
        setMetadataError(metadata.symbol || metadata.name ? null : "No token metadata returned.")
      } catch (error) {
        if (cancelled) return
        setMetadataStatus("error")
        setMetadataError(error instanceof Error ? error.message : "Unable to fetch token metadata.")
      }
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    assetType,
    commitParams,
    params?.assetName,
    params?.assetSymbol,
    params?.token,
    selectedNode,
    tokenInput,
  ])

  if (!selectedNode || selectedNode.type !== "Transfer") {
    return null
  }

  const chooseNative = () => {
    setTokenInput("")
    setMetadataStatus("idle")
    setMetadataError(null)
    commitParams({
      assetType: "native",
      token: undefined,
      assetSymbol: undefined,
      assetName: undefined,
    })
  }

  const chooseSac = () => {
    commitParams({
      assetType: "sac",
      token: tokenInput.trim(),
      assetSymbol: undefined,
      assetName: undefined,
    })
  }

  const updateToken = (value: string) => {
    setTokenInput(value)
    setMetadataStatus("idle")
    setMetadataError(null)
    commitParams({
      assetType: "sac",
      token: value.trim(),
      assetSymbol: undefined,
      assetName: undefined,
    })
  }

  const fetchMetadata = async () => {
    const nextValidation = validateTransferAssetSelection({ assetType: "sac", token: tokenInput })
    if (!nextValidation.ok) {
      setMetadataStatus("error")
      setMetadataError(nextValidation.error ?? "Invalid token address.")
      return
    }

    setMetadataStatus("loading")
    setMetadataError(null)

    try {
      const metadata = await fetchSacTokenMetadata(tokenInput.trim())
      commitParams({
        assetType: "sac",
        token: tokenInput.trim(),
        assetSymbol: metadata.symbol,
        assetName: metadata.name,
      })
      setMetadataStatus(metadata.symbol || metadata.name ? "loaded" : "error")
      setMetadataError(metadata.symbol || metadata.name ? null : "No token metadata returned.")
    } catch (error) {
      setMetadataStatus("error")
      setMetadataError(error instanceof Error ? error.message : "Unable to fetch token metadata.")
    }
  }

  const activeLabel = formatAssetLabel({
    assetType,
    token: params?.token,
    assetSymbol: params?.assetSymbol,
    assetName: params?.assetName,
  })

  return (
    <aside className="absolute right-4 top-20 z-20 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Transfer asset</h2>
          <p className="mt-1 text-xs text-slate-500">{selectedNode.data.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close transfer asset panel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={chooseNative}
          className={`rounded border px-3 py-2 text-sm font-semibold transition-colors ${
            assetType === "native"
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Native XLM
        </button>
        <button
          type="button"
          onClick={chooseSac}
          className={`rounded border px-3 py-2 text-sm font-semibold transition-colors ${
            assetType === "sac"
              ? "border-blue-500 bg-blue-50 text-blue-800"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Custom SAC
        </button>
      </div>

      {assetType === "sac" && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Token contract address
          </label>
          <input
            value={tokenInput}
            onChange={(event) => updateToken(event.target.value)}
            placeholder="C..."
            spellCheck={false}
            className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {!validation.ok && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {validation.error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void fetchMetadata()}
            disabled={!validation.ok || metadataStatus === "loading"}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {metadataStatus === "loading" ? "Fetching metadata..." : "Refresh token metadata"}
          </button>
          {metadataStatus === "error" && metadataError && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {metadataError}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Selected asset: <span className="font-semibold text-slate-900">{activeLabel}</span>
      </div>
    </aside>
  )
}
