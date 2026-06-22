"use client"

import { X } from "lucide-react"
import type { Node } from "reactflow"

import {
  CONDITION_OPERAND_KINDS,
  CONDITION_OPERATORS,
  CONDITION_VALUE_TYPES,
  type ConditionExpression,
  type ConditionOperand,
  type ConditionOperandKind,
  type ConditionValueType,
} from "@/lib/compile/schema"
import {
  formatConditionExpression,
  getConditionExpressionOrDefault,
  validateConditionExpression,
} from "@/lib/compile/conditionExpression"

interface Props {
  node: Node
  onChange: (expression: ConditionExpression) => void
  onClose: () => void
}

const OPERAND_LABELS: Record<ConditionOperandKind, string> = {
  argument: "Invocation argument",
  storage: "Storage key",
  constant: "Constant",
}

const VALUE_TYPE_LABELS: Record<ConditionValueType, string> = {
  number: "Number",
  string: "String",
  boolean: "Boolean",
}

function normalizeOperandForKind(
  operand: ConditionOperand,
  kind: ConditionOperandKind,
  valueType = operand.valueType
): ConditionOperand {
  if (kind === "argument") {
    return { kind, valueType, name: operand.name?.trim() || (valueType === "number" ? "amount" : "flag") }
  }

  if (kind === "storage") {
    return { kind, valueType, name: operand.name?.trim() || "stored" }
  }

  return { kind, valueType, value: defaultConstantValue(valueType, operand.value) }
}

function defaultConstantValue(valueType: ConditionValueType, currentValue?: string): string {
  const trimmed = currentValue?.trim() ?? ""
  if (trimmed.length > 0) return trimmed

  switch (valueType) {
    case "boolean":
      return "true"
    case "string":
      return "owner"
    case "number":
    default:
      return "0"
  }
}

function OperandEditor({
  label,
  operand,
  onChange,
}: {
  label: string
  operand: ConditionOperand
  onChange: (operand: ConditionOperand) => void
}) {
  const updateKind = (kind: ConditionOperandKind) => {
    onChange(normalizeOperandForKind(operand, kind))
  }

  const updateValueType = (valueType: ConditionValueType) => {
    onChange(normalizeOperandForKind({ ...operand, valueType }, operand.kind, valueType))
  }

  const valueLabel = operand.kind === "constant" ? "Value" : operand.kind === "storage" ? "Key" : "Name"
  const value = operand.kind === "constant" ? operand.value ?? "" : operand.name ?? ""

  return (
    <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <legend className="px-1 text-xs font-semibold uppercase text-slate-500">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Source</span>
          <select
            value={operand.kind}
            onChange={(event) => updateKind(event.target.value as ConditionOperandKind)}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            {CONDITION_OPERAND_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {OPERAND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Type</span>
          <select
            value={operand.valueType}
            onChange={(event) => updateValueType(event.target.value as ConditionValueType)}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            {CONDITION_VALUE_TYPES.map((valueType) => (
              <option key={valueType} value={valueType}>
                {VALUE_TYPE_LABELS[valueType]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">{valueLabel}</span>
        {operand.kind === "constant" && operand.valueType === "boolean" ? (
          <select
            value={value}
            onChange={(event) => onChange({ ...operand, value: event.target.value })}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={operand.valueType === "number" && operand.kind === "constant" ? "number" : "text"}
            value={value}
            onChange={(event) =>
              onChange(
                operand.kind === "constant"
                  ? { ...operand, value: event.target.value }
                  : { ...operand, name: event.target.value }
              )
            }
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          />
        )}
      </label>
    </fieldset>
  )
}

export default function ConditionExpressionPanel({ node, onChange, onClose }: Props) {
  const expression = getConditionExpressionOrDefault(node.data?.params?.expression)
  const validation = validateConditionExpression(expression)

  const updateExpression = (patch: Partial<ConditionExpression>) => {
    onChange({ ...expression, ...patch })
  }

  return (
    <aside className="absolute left-4 bottom-4 z-20 w-[360px] rounded-lg border border-slate-200 bg-white shadow-lg">
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Condition</p>
          <p className="truncate text-xs text-slate-500">{node.data?.label ?? "Condition"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close condition panel"
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <OperandEditor
          label="Left"
          operand={expression.left}
          onChange={(left) => updateExpression({ left })}
        />

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Operator</span>
          <select
            value={expression.operator}
            onChange={(event) =>
              updateExpression({ operator: event.target.value as ConditionExpression["operator"] })
            }
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            {CONDITION_OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </select>
        </label>

        <OperandEditor
          label="Right"
          operand={expression.right}
          onChange={(right) => updateExpression({ right })}
        />

        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            validation.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold">{formatConditionExpression(expression)}</p>
          {!validation.ok && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {validation.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}
