"use client"

import React from "react"
import type {
  ConditionExpression,
  Operand,
  OperandType,
  Operator,
} from "@/lib/compile/schema"
import { OPERATORS } from "@/lib/compile/schema"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERAND_TYPE_LABELS: Record<OperandType, string> = {
  constant: "Constant",
  storageKey: "Storage Key",
  invocationArg: "Argument",
}

/** Well-known invocation argument names derived from the codegen param list. */
const INVOCATION_ARGS = [
  "caller",
  "from",
  "to",
  "amount",
  "token",
  "key",
  "value",
  "event_name",
  "release",
]

const DEFAULT_OPERAND: Operand = { type: "invocationArg", value: "" }

// ---------------------------------------------------------------------------
// Helper: is an expression complete enough to be considered valid?
// ---------------------------------------------------------------------------
export function isExpressionComplete(expr: ConditionExpression | undefined): boolean {
  if (!expr) return false
  return (
    expr.left.value.trim() !== "" &&
    expr.right.value.trim() !== "" &&
    Boolean(expr.operator)
  )
}

// ---------------------------------------------------------------------------
// Sub-component: OperandPicker
// ---------------------------------------------------------------------------

interface OperandPickerProps {
  id: string
  value: Operand
  onChange: (op: Operand) => void
  disabled?: boolean
  /** Argument names selectable in addition to the built-in invocation args. */
  extraArgs?: string[]
}

function OperandPicker({ id, value, onChange, disabled, extraArgs }: OperandPickerProps) {
  const argOptions = [...INVOCATION_ARGS, ...(extraArgs ?? []).filter((arg) => !INVOCATION_ARGS.includes(arg))]

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as OperandType
    onChange({ type: newType, value: "", constantKind: newType === "constant" ? "string" : undefined })
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...value, value: e.target.value })
  }

  const handleConstantKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, constantKind: e.target.value as Operand["constantKind"], value: "" })
  }

  const inputClass =
    "mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
    "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"

  const isInvalid = value.value.trim() === ""

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* Operand type selector */}
      <select
        id={`${id}-type`}
        value={value.type}
        onChange={handleTypeChange}
        disabled={disabled}
        aria-label="Operand type"
        className={`${inputClass} cursor-pointer`}
      >
        {(Object.keys(OPERAND_TYPE_LABELS) as OperandType[]).map((t) => (
          <option key={t} value={t}>
            {OPERAND_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      {/* Operand value input — varies by type */}
      {value.type === "constant" && (
        <div className="flex flex-col gap-1">
          <select
            id={`${id}-constant-kind`}
            value={value.constantKind ?? "string"}
            onChange={handleConstantKindChange}
            disabled={disabled}
            aria-label="Constant kind"
            className={`${inputClass} cursor-pointer`}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="bool">Boolean</option>
          </select>

          {value.constantKind === "bool" ? (
            <select
              id={`${id}-value`}
              value={value.value}
              onChange={handleValueChange}
              disabled={disabled}
              aria-label="Boolean value"
              className={`${inputClass} cursor-pointer ${isInvalid ? "ring-2 ring-red-400" : ""}`}
            >
              <option value="">-- pick --</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              id={`${id}-value`}
              type={value.constantKind === "number" ? "number" : "text"}
              value={value.value}
              onChange={handleValueChange}
              disabled={disabled}
              placeholder={value.constantKind === "number" ? "e.g. 100" : 'e.g. "owner"'}
              aria-label="Constant value"
              aria-invalid={isInvalid}
              className={`${inputClass} ${isInvalid ? "ring-2 ring-red-400" : ""}`}
            />
          )}
        </div>
      )}

      {value.type === "storageKey" && (
        <input
          id={`${id}-value`}
          type="text"
          value={value.value}
          onChange={handleValueChange}
          disabled={disabled}
          placeholder="e.g. balance"
          aria-label="Storage key name"
          aria-invalid={isInvalid}
          className={`${inputClass} ${isInvalid ? "ring-2 ring-red-400" : ""}`}
        />
      )}

      {value.type === "invocationArg" && (
        <select
          id={`${id}-value`}
          value={value.value}
          onChange={handleValueChange}
          disabled={disabled}
          aria-label="Argument name"
          aria-invalid={isInvalid}
          className={`${inputClass} cursor-pointer ${isInvalid ? "ring-2 ring-red-400" : ""}`}
        >
          <option value="">-- pick arg --</option>
          {argOptions.map((arg) => (
            <option key={arg} value={arg}>
              {arg}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component: ConditionExpressionBuilder
// ---------------------------------------------------------------------------

export interface ConditionExpressionBuilderProps {
  /** Current expression value (undefined = not yet set) */
  value: ConditionExpression | undefined
  /** Called on every change with the updated expression */
  onChange: (expr: ConditionExpression) => void
  /** When true, all controls are read-only */
  disabled?: boolean
  /**
   * Extra argument names offered by the "Argument" operand type — e.g. the
   * `returnBinding` of an upstream CrossContractCall block.
   */
  extraArgs?: string[]
}

export default function ConditionExpressionBuilder({
  value,
  onChange,
  disabled = false,
  extraArgs,
}: ConditionExpressionBuilderProps) {
  const expr: ConditionExpression = value ?? {
    left: { ...DEFAULT_OPERAND },
    operator: "==",
    right: { ...DEFAULT_OPERAND },
  }

  const handleLeftChange = (left: Operand) => onChange({ ...expr, left })
  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...expr, operator: e.target.value as Operator })
  const handleRightChange = (right: Operand) => onChange({ ...expr, right })

  const isComplete = isExpressionComplete(expr)

  return (
    <div
      role="group"
      aria-label="Condition expression builder"
      className="flex flex-col gap-2"
    >
      {/* Three-column row: left operand | operator | right operand */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        {/* Left operand */}
        <OperandPicker
          id="condition-left"
          value={expr.left}
          onChange={handleLeftChange}
          disabled={disabled}
          extraArgs={extraArgs}
        />

        {/* Operator */}
        <div className="flex flex-col items-center justify-center pt-1">
          <select
            id="condition-operator"
            value={expr.operator}
            onChange={handleOperatorChange}
            disabled={disabled}
            aria-label="Comparison operator"
            className={
              "rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-semibold " +
              "text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer " +
              "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"
            }
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        {/* Right operand */}
        <OperandPicker
          id="condition-right"
          value={expr.right}
          onChange={handleRightChange}
          disabled={disabled}
          extraArgs={extraArgs}
        />
      </div>

      {/* Inline validation hint */}
      {!isComplete && (
        <p
          role="alert"
          className="text-[10px] font-medium text-red-500 dark:text-red-400"
        >
          Both sides of the condition must be filled in.
        </p>
      )}

      {/* Preview of generated expression (for debugging / transparency) */}
      {isComplete && (
        <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          if{" "}
          <span className="text-rose-600 dark:text-rose-400">
            {operandPreview(expr.left)} {expr.operator} {operandPreview(expr.right)}
          </span>
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: human-readable operand preview
// ---------------------------------------------------------------------------
function operandPreview(op: Operand): string {
  switch (op.type) {
    case "constant":
      if (op.constantKind === "string") return `"${op.value}"`
      return op.value
    case "storageKey":
      return `storage["${op.value}"]`
    case "invocationArg":
      return op.value
    default:
      return op.value
  }
}
