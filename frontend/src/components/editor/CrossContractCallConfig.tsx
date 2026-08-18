"use client"

import React, { useMemo, useRef, useState } from "react"
import { Plus, Trash2, Upload } from "lucide-react"
import {
  CROSS_CONTRACT_ARG_SOURCES,
  CROSS_CONTRACT_TYPES,
  type CrossContractArg,
  type CrossContractArgSource,
  type CrossContractType,
} from "@/lib/compile/schema"

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface CrossContractCallValue {
  targetContractId?: string
  targetFunction?: string
  targetArgs?: CrossContractArg[]
  returnBinding?: string
  returnType?: string
}

export interface CrossContractCallConfigProps {
  value: CrossContractCallValue
  onChange: (patch: CrossContractCallValue) => void
  /** Invocation argument names selectable as an argument value source. */
  availableArgs?: string[]
  disabled?: boolean
}

/** A single function entry parsed out of a pasted contract ABI. */
interface AbiFunction {
  name: string
  args: Array<{ name: string; rustType: CrossContractType; declaredType: string }>
  returnType?: CrossContractType
  unsupported: string[]
}

const ARG_SOURCE_LABELS: Record<CrossContractArgSource, string> = {
  literal: "Literal",
  storageKey: "Storage Key",
  invocationArg: "Argument",
}

const DEFAULT_ARGS: string[] = ["caller", "from", "to", "amount", "token", "key", "value"]

const inputClass =
  "mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"

const labelClass =
  "text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300"

// ---------------------------------------------------------------------------
// ABI parsing
// ---------------------------------------------------------------------------

/** Maps an ABI type name onto one of the Rust primitives the compiler supports. */
export function mapAbiType(declared: string): CrossContractType | null {
  const normalized = declared.trim().toLowerCase()

  if (["address"].includes(normalized)) return "Address"
  if (["symbol"].includes(normalized)) return "Symbol"
  if (["bool", "boolean"].includes(normalized)) return "bool"
  if (["i32", "i64", "i128", "u32", "u64", "u128", "int", "number"].includes(normalized)) {
    return "i128"
  }

  return null
}

/**
 * Parses a pasted/uploaded contract ABI into a function list.
 * Accepts either a bare array of functions or `{ functions: [...] }`, with
 * arguments under `inputs`, `args` or `params`, and a return under
 * `outputs`, `returns` or `returnType`.
 */
export function parseAbi(text: string): { ok: true; functions: AbiFunction[] } | { ok: false; error: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: "ABI is not valid JSON." }
  }

  const rawFunctions = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).functions)
      ? ((parsed as Record<string, unknown>).functions as unknown[])
      : null

  if (!rawFunctions) {
    return { ok: false, error: "ABI must be an array of functions or an object with a functions array." }
  }

  const functions: AbiFunction[] = []

  for (const entry of rawFunctions) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name : ""
    if (name === "") continue

    const rawArgs =
      (Array.isArray(record.inputs) && record.inputs) ||
      (Array.isArray(record.args) && record.args) ||
      (Array.isArray(record.params) && record.params) ||
      []

    const unsupported: string[] = []
    const args: AbiFunction["args"] = []

    for (let i = 0; i < rawArgs.length; i++) {
      const rawArg = rawArgs[i]
      if (typeof rawArg !== "object" || rawArg === null) continue
      const argRecord = rawArg as Record<string, unknown>
      const declaredType = String(argRecord.type ?? argRecord.rustType ?? argRecord.value ?? "")
      const mapped = mapAbiType(declaredType)
      if (!mapped) unsupported.push(`${String(argRecord.name ?? `arg${i + 1}`)}: ${declaredType || "unknown"}`)

      args.push({
        name: typeof argRecord.name === "string" && argRecord.name ? argRecord.name : `arg${i + 1}`,
        rustType: mapped ?? "i128",
        declaredType,
      })
    }

    const rawReturn = Array.isArray(record.outputs)
      ? record.outputs[0]
      : (record.returns ?? record.returnType ?? record.output)

    const declaredReturn =
      typeof rawReturn === "string"
        ? rawReturn
        : typeof rawReturn === "object" && rawReturn !== null
          ? String((rawReturn as Record<string, unknown>).type ?? "")
          : ""

    functions.push({
      name,
      args,
      returnType: declaredReturn ? (mapAbiType(declaredReturn) ?? undefined) : undefined,
      unsupported,
    })
  }

  if (functions.length === 0) {
    return { ok: false, error: "No named functions found in the ABI." }
  }

  return { ok: true, functions }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrossContractCallConfig({
  value,
  onChange,
  availableArgs,
  disabled = false,
}: CrossContractCallConfigProps) {
  const [abiText, setAbiText] = useState("")
  const [abiFunctions, setAbiFunctions] = useState<AbiFunction[] | null>(null)
  const [abiError, setAbiError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const args = useMemo(() => value.targetArgs ?? [], [value.targetArgs])
  const contractId = value.targetContractId ?? ""
  const targetFunction = value.targetFunction ?? ""
  const returnBinding = value.returnBinding ?? ""

  const argOptions = availableArgs && availableArgs.length > 0 ? availableArgs : DEFAULT_ARGS

  const selectedAbiFunction = abiFunctions?.find((fn) => fn.name === targetFunction)

  // ABI type mismatches between the declared signature and the configured args
  const typeMismatches = useMemo(() => {
    if (!selectedAbiFunction) return []
    return args
      .map((arg, index) => {
        const declared = selectedAbiFunction.args[index]
        if (!declared) return `${arg.name}: not present in the ABI signature`
        if (declared.rustType !== arg.rustType) {
          return `${arg.name}: ABI declares ${declared.declaredType || declared.rustType}, configured as ${arg.rustType}`
        }
        return null
      })
      .filter((entry): entry is string => entry !== null)
  }, [args, selectedAbiFunction])

  const errors: string[] = []
  if (contractId.trim() === "") errors.push("A target contract address is required.")
  if (targetFunction.trim() === "") errors.push("A target function name is required.")

  const updateArg = (index: number, patch: Partial<CrossContractArg>) => {
    const next = args.map((arg, i) => (i === index ? { ...arg, ...patch } : arg))
    onChange({ targetArgs: next })
  }

  const addArg = () => {
    const next: CrossContractArg[] = [
      ...args,
      { name: `arg${args.length + 1}`, value: "", rustType: "i128", source: "literal" },
    ]
    onChange({ targetArgs: next })
  }

  const removeArg = (index: number) => {
    onChange({ targetArgs: args.filter((_, i) => i !== index) })
  }

  const applyAbi = (text: string) => {
    setAbiText(text)

    if (text.trim() === "") {
      setAbiFunctions(null)
      setAbiError(null)
      return
    }

    const result = parseAbi(text)
    if (!result.ok) {
      setAbiFunctions(null)
      setAbiError(result.error)
      return
    }

    setAbiFunctions(result.functions)
    setAbiError(null)
  }

  const handleAbiFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      applyAbi(await file.text())
    } catch {
      setAbiError("Could not read the selected file.")
    }
  }

  /** Selecting an ABI function pre-fills the function name and its argument slots. */
  const selectAbiFunction = (name: string) => {
    const fn = abiFunctions?.find((candidate) => candidate.name === name)
    if (!fn) {
      onChange({ targetFunction: name })
      return
    }

    onChange({
      targetFunction: fn.name,
      targetArgs: fn.args.map((arg) => ({
        name: arg.name,
        value: "",
        rustType: arg.rustType,
        source: "literal" as CrossContractArgSource,
      })),
      ...(fn.returnType ? { returnType: fn.returnType } : {}),
    })
  }

  return (
    <div
      data-testid="cross-contract-config-panel"
      role="group"
      aria-label="Cross-contract call configuration"
      className="flex w-[300px] flex-col gap-3"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Target contract + function                                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className={labelClass} htmlFor="cross-contract-address">
          Contract Address
        </label>
        <input
          id="cross-contract-address"
          data-testid="cross-contract-address"
          type="text"
          value={contractId}
          disabled={disabled}
          onChange={(e) => onChange({ targetContractId: e.target.value })}
          placeholder="C… deployed contract address"
          aria-invalid={contractId.trim() === ""}
          className={`${inputClass} font-mono ${contractId.trim() === "" ? "ring-2 ring-red-400" : ""}`}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="cross-contract-function">
          Function
        </label>
        {abiFunctions ? (
          <select
            id="cross-contract-function"
            data-testid="cross-contract-function-select"
            value={targetFunction}
            disabled={disabled}
            onChange={(e) => selectAbiFunction(e.target.value)}
            className={`${inputClass} cursor-pointer ${targetFunction.trim() === "" ? "ring-2 ring-red-400" : ""}`}
          >
            <option value="">-- pick function --</option>
            {abiFunctions.map((fn) => (
              <option key={fn.name} value={fn.name}>
                {fn.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="cross-contract-function"
            data-testid="cross-contract-function"
            type="text"
            value={targetFunction}
            disabled={disabled}
            onChange={(e) => onChange({ targetFunction: e.target.value })}
            placeholder="e.g. stake"
            aria-invalid={targetFunction.trim() === ""}
            className={`${inputClass} font-mono ${targetFunction.trim() === "" ? "ring-2 ring-red-400" : ""}`}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Optional ABI                                                        */}
      {/* ------------------------------------------------------------------ */}
      <details className="rounded border border-indigo-200 px-2 py-1.5 dark:border-indigo-800">
        <summary className={`${labelClass} cursor-pointer`}>Contract ABI (optional)</summary>
        <textarea
          data-testid="cross-contract-abi"
          value={abiText}
          disabled={disabled}
          onChange={(e) => applyAbi(e.target.value)}
          rows={3}
          placeholder='[{ "name": "stake", "inputs": [{ "name": "amount", "type": "i128" }], "outputs": ["i128"] }]'
          className={`${inputClass} font-mono`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="mt-1 flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Upload size={11} />
          Upload ABI
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleAbiFile(e)}
        />
        {abiError && (
          <p role="alert" className="mt-1 text-[10px] font-medium text-red-500 dark:text-red-400">
            {abiError}
          </p>
        )}
        {selectedAbiFunction && selectedAbiFunction.unsupported.length > 0 && (
          <p role="alert" className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            Unsupported ABI types: {selectedAbiFunction.unsupported.join(", ")}
          </p>
        )}
      </details>

      {/* ------------------------------------------------------------------ */}
      {/* Arguments                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Arguments</span>
          <button
            type="button"
            data-testid="cross-contract-add-arg"
            onClick={addArg}
            disabled={disabled}
            className="flex items-center gap-1 rounded border border-indigo-200 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
          >
            <Plus size={11} />
            Add
          </button>
        </div>

        {args.length === 0 && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            No arguments — the call is emitted with an empty argument list.
          </p>
        )}

        {args.map((arg, index) => (
          <div
            key={index}
            data-testid={`cross-contract-arg-${index}`}
            className="rounded border border-slate-200 p-1.5 dark:border-slate-600"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                data-testid={`cross-contract-arg-name-${index}`}
                value={arg.name}
                disabled={disabled}
                onChange={(e) => updateArg(index, { name: e.target.value })}
                placeholder="name"
                aria-label={`Argument ${index + 1} name`}
                className={`${inputClass} font-mono`}
              />
              <select
                data-testid={`cross-contract-arg-type-${index}`}
                value={arg.rustType}
                disabled={disabled}
                onChange={(e) => updateArg(index, { rustType: e.target.value })}
                aria-label={`Argument ${index + 1} type`}
                className={`${inputClass} cursor-pointer`}
              >
                {CROSS_CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid={`cross-contract-arg-remove-${index}`}
                onClick={() => removeArg(index)}
                disabled={disabled}
                aria-label={`Remove argument ${index + 1}`}
                className="mt-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <select
                data-testid={`cross-contract-arg-source-${index}`}
                value={arg.source ?? "literal"}
                disabled={disabled}
                onChange={(e) =>
                  updateArg(index, { source: e.target.value as CrossContractArgSource, value: "" })
                }
                aria-label={`Argument ${index + 1} value source`}
                className={`${inputClass} cursor-pointer`}
              >
                {CROSS_CONTRACT_ARG_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {ARG_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>

              {(arg.source ?? "literal") === "invocationArg" ? (
                <select
                  data-testid={`cross-contract-arg-value-${index}`}
                  value={arg.value}
                  disabled={disabled}
                  onChange={(e) => updateArg(index, { value: e.target.value })}
                  aria-label={`Argument ${index + 1} value`}
                  className={`${inputClass} cursor-pointer font-mono`}
                >
                  <option value="">-- pick arg --</option>
                  {argOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  data-testid={`cross-contract-arg-value-${index}`}
                  value={arg.value}
                  disabled={disabled}
                  onChange={(e) => updateArg(index, { value: e.target.value })}
                  placeholder={(arg.source ?? "literal") === "storageKey" ? "storage key" : "value"}
                  aria-label={`Argument ${index + 1} value`}
                  className={`${inputClass} font-mono`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Return binding                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start gap-1">
        <div className="flex-1">
          <label className={labelClass} htmlFor="cross-contract-return-binding">
            Return Binding
          </label>
          <input
            id="cross-contract-return-binding"
            data-testid="cross-contract-return-binding"
            type="text"
            value={returnBinding}
            disabled={disabled}
            onChange={(e) => onChange({ returnBinding: e.target.value })}
            placeholder="e.g. stake_result"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div className="w-24">
          <label className={labelClass} htmlFor="cross-contract-return-type">
            Type
          </label>
          <select
            id="cross-contract-return-type"
            data-testid="cross-contract-return-type"
            value={value.returnType ?? "i128"}
            disabled={disabled || returnBinding.trim() === ""}
            onChange={(e) => onChange({ returnType: e.target.value })}
            className={`${inputClass} cursor-pointer`}
          >
            {CROSS_CONTRACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {returnBinding.trim() !== "" && (
        <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Usable as an argument operand in downstream Condition blocks.
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Validation                                                          */}
      {/* ------------------------------------------------------------------ */}
      {errors.length > 0 && (
        <p
          role="alert"
          data-testid="cross-contract-error"
          className="text-[10px] font-medium text-red-500 dark:text-red-400"
        >
          {errors.join(" ")}
        </p>
      )}

      {errors.length === 0 && typeMismatches.length > 0 && (
        <p
          role="alert"
          data-testid="cross-contract-error"
          className="text-[10px] font-medium text-amber-600 dark:text-amber-400"
        >
          {typeMismatches.join("; ")}
        </p>
      )}
    </div>
  )
}
