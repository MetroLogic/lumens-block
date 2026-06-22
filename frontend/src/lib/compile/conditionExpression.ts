import {
  CONDITION_OPERAND_KINDS,
  CONDITION_OPERATORS,
  CONDITION_VALUE_TYPES,
  type ConditionExpression,
  type ConditionOperand,
  type ConditionOperandKind,
  type ConditionOperator,
  type ConditionValueType,
} from "./schema"

export interface ConditionExpressionValidation {
  ok: boolean
  details: string[]
}

export interface ConditionInvocationArgument {
  name: string
  valueType: ConditionValueType
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function createDefaultConditionExpression(): ConditionExpression {
  return {
    left: { kind: "argument", valueType: "number", name: "amount" },
    operator: ">",
    right: { kind: "constant", valueType: "number", value: "0" },
  }
}

export function isConditionOperator(value: unknown): value is ConditionOperator {
  return typeof value === "string" && CONDITION_OPERATORS.includes(value as ConditionOperator)
}

export function isConditionOperandKind(value: unknown): value is ConditionOperandKind {
  return typeof value === "string" && CONDITION_OPERAND_KINDS.includes(value as ConditionOperandKind)
}

export function isConditionValueType(value: unknown): value is ConditionValueType {
  return typeof value === "string" && CONDITION_VALUE_TYPES.includes(value as ConditionValueType)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseOperand(raw: unknown): ConditionOperand | null {
  if (!isPlainObject(raw)) return null

  const { kind, valueType, name, value } = raw
  if (!isConditionOperandKind(kind) || !isConditionValueType(valueType)) {
    return null
  }

  return {
    kind,
    valueType,
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof value === "string" ? { value } : {}),
  }
}

export function parseConditionExpression(raw: unknown): ConditionExpression | null {
  if (!isPlainObject(raw)) return null

  const left = parseOperand(raw.left)
  const right = parseOperand(raw.right)
  if (!left || !right || !isConditionOperator(raw.operator)) {
    return null
  }

  return { left, operator: raw.operator, right }
}

export function getConditionExpressionOrDefault(raw: unknown): ConditionExpression {
  return parseConditionExpression(raw) ?? createDefaultConditionExpression()
}

function operandLabel(operand: ConditionOperand): string {
  if (operand.kind === "argument") {
    return operand.name?.trim() || "argument"
  }

  if (operand.kind === "storage") {
    return `storage[${operand.name?.trim() || "key"}]`
  }

  if (operand.valueType === "string") {
    return `"${operand.value?.trim() ?? ""}"`
  }

  return operand.value?.trim() || (operand.valueType === "boolean" ? "false" : "0")
}

export function formatConditionExpression(expression: ConditionExpression): string {
  return `${operandLabel(expression.left)} ${expression.operator} ${operandLabel(expression.right)}`
}

function validateOperand(operand: ConditionOperand, side: "left" | "right"): string[] {
  const details: string[] = []
  const label = side === "left" ? "Left operand" : "Right operand"

  if (operand.kind === "argument") {
    const name = operand.name?.trim() ?? ""
    if (!IDENTIFIER_PATTERN.test(name)) {
      details.push(`${label} must use a valid invocation argument name.`)
    }
    return details
  }

  if (operand.kind === "storage") {
    if ((operand.name?.trim() ?? "").length === 0) {
      details.push(`${label} must include a storage key.`)
    }
    return details
  }

  const value = operand.value?.trim() ?? ""
  if (operand.valueType === "number" && !/^-?\d+$/.test(value)) {
    details.push(`${label} constant must be a whole number.`)
  }

  if (operand.valueType === "string" && value.length === 0) {
    details.push(`${label} constant must include text.`)
  }

  if (operand.valueType === "boolean" && value !== "true" && value !== "false") {
    details.push(`${label} constant must be true or false.`)
  }

  return details
}

export function validateConditionExpression(
  expression: ConditionExpression
): ConditionExpressionValidation {
  const details = [
    ...validateOperand(expression.left, "left"),
    ...validateOperand(expression.right, "right"),
  ]

  if (expression.left.valueType !== expression.right.valueType) {
    details.push("Both operands must use the same value type.")
  }

  if (
    expression.left.valueType !== "number" &&
    !["==", "!="].includes(expression.operator)
  ) {
    details.push("Only number expressions can use range operators.")
  }

  return { ok: details.length === 0, details }
}

export function getConditionInvocationArguments(
  expression: ConditionExpression
): ConditionInvocationArgument[] {
  const args = new Map<string, ConditionValueType>()

  for (const operand of [expression.left, expression.right]) {
    if (operand.kind !== "argument") continue

    const name = operand.name?.trim() ?? ""
    if (IDENTIFIER_PATTERN.test(name)) {
      args.set(name, operand.valueType)
    }
  }

  return Array.from(args.entries()).map(([name, valueType]) => ({ name, valueType }))
}
