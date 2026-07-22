"use client"

import React, { useEffect, useRef, useState } from "react"
import type { AssetKind, TransferAsset } from "@/lib/compile/schema"
import {
  fetchTokenMetadata,
  getNativeXlmAsset,
  isValidContractAddress,
  TokenMetadataError,
} from "@/lib/stellar/tokenMetadata"

const DEBOUNCE_MS = 400

const inputClass =
  "mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent " +
  "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"

export interface AssetSelectorProps {
  value: TransferAsset | undefined
  onChange: (asset: TransferAsset) => void
  disabled?: boolean
}

export default function AssetSelector({
  value,
  onChange,
  disabled = false,
}: AssetSelectorProps) {
  const kind: AssetKind = value?.kind ?? "xlm"
  const [addressInput, setAddressInput] = useState(
    value?.kind === "sac" ? (value.contractId ?? "") : ""
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Keep local address field in sync when parent switches to a stored SAC value
  useEffect(() => {
    if (value?.kind === "sac" && value.contractId && value.contractId !== addressInput.trim()) {
      // Only sync from parent when the stored id differs from what the user is typing
      // and matches a completed selection (has symbol) or is the only source of truth.
      if (value.symbol || addressInput.trim() === "") {
        setAddressInput(value.contractId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addressInput intentionally omitted to avoid fighting user input
  }, [value?.kind, value?.contractId, value?.symbol])

  const selectXlm = () => {
    setError(null)
    setLoading(false)
    setAddressInput("")
    onChange(getNativeXlmAsset())
  }

  const selectSac = () => {
    setError(null)
    onChange({
      kind: "sac",
      contractId: addressInput.trim() || undefined,
      symbol: undefined,
      name: undefined,
    })
  }

  // Debounced metadata fetch for SAC addresses
  useEffect(() => {
    if (kind !== "sac") return

    const trimmed = addressInput.trim()
    if (!trimmed) {
      setError(null)
      setLoading(false)
      return
    }

    if (!isValidContractAddress(trimmed)) {
      setError("Invalid contract address")
      setLoading(false)
      if (value?.contractId !== trimmed || value?.symbol) {
        onChangeRef.current({
          kind: "sac",
          contractId: trimmed,
          symbol: undefined,
          name: undefined,
        })
      }
      return
    }

    // Already resolved for this address
    if (value?.kind === "sac" && value.contractId === trimmed && value.symbol) {
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const meta = await fetchTokenMetadata(trimmed)
          if (requestId !== requestIdRef.current) return
          setError(null)
          onChangeRef.current({
            kind: "sac",
            contractId: trimmed,
            symbol: meta.symbol,
            name: meta.name,
          })
        } catch (err) {
          if (requestId !== requestIdRef.current) return
          const message =
            err instanceof TokenMetadataError
              ? err.message
              : "Unable to fetch token metadata"
          setError(message)
          onChangeRef.current({
            kind: "sac",
            contractId: trimmed,
            symbol: undefined,
            name: undefined,
          })
        } finally {
          if (requestId === requestIdRef.current) {
            setLoading(false)
          }
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [kind, addressInput, value?.kind, value?.contractId, value?.symbol])

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressInput(e.target.value)
  }

  const displaySymbol =
    kind === "xlm" ? value?.symbol ?? "XLM" : value?.symbol
  const displayName =
    kind === "xlm" ? value?.name ?? "native" : value?.name

  return (
    <div
      role="group"
      aria-label="Asset selector"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-emerald-900 dark:text-emerald-100">
          <input
            type="radio"
            name="asset-kind"
            value="xlm"
            checked={kind === "xlm"}
            onChange={selectXlm}
            disabled={disabled}
            className="accent-emerald-600"
          />
          Native XLM
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-emerald-900 dark:text-emerald-100">
          <input
            type="radio"
            name="asset-kind"
            value="sac"
            checked={kind === "sac"}
            onChange={selectSac}
            disabled={disabled}
            className="accent-emerald-600"
          />
          Custom SAC token
        </label>
      </div>

      {kind === "xlm" && (
        <p className="rounded bg-emerald-100/60 px-2 py-1 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <span className="font-semibold">{displaySymbol}</span>
          {displayName ? ` · ${displayName}` : ""}
        </p>
      )}

      {kind === "sac" && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="sac-contract-address"
            className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
          >
            Contract address
          </label>
          <input
            id="sac-contract-address"
            type="text"
            value={addressInput}
            onChange={handleAddressChange}
            disabled={disabled}
            placeholder="C…"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "sac-address-error" : undefined}
            className={`${inputClass} font-mono ${error ? "ring-2 ring-red-400" : ""}`}
          />

          {loading && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
              Fetching token metadata…
            </p>
          )}

          {!loading && error && (
            <p
              id="sac-address-error"
              role="alert"
              className="text-[10px] font-medium text-red-500 dark:text-red-400"
            >
              {error}
            </p>
          )}

          {!loading && !error && displaySymbol && (
            <p className="rounded bg-emerald-100/60 px-2 py-1 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              <span className="font-semibold">{displaySymbol}</span>
              {displayName ? ` · ${displayName}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
