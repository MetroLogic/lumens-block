import { describe, expect, it } from "vitest"

import {
  createDefaultConditionExpression,
  formatConditionExpression,
  getConditionInvocationArguments,
  parseConditionExpression,
  validateConditionExpression,
} from "@/lib/compile/conditionExpression"

describe("condition expression helpers", () => {
  it("formats the default expression for display", () => {
    const expression = createDefaultConditionExpression()

    expect(formatConditionExpression(expression)).toBe("amount > 0")
  })

  it("extracts invocation arguments from both sides", () => {
    const expression = {
      left: { kind: "argument", valueType: "number", name: "amount" },
      operator: ">=",
      right: { kind: "argument", valueType: "number", name: "minimum" },
    } as const

    expect(getConditionInvocationArguments(expression)).toEqual([
      { name: "amount", valueType: "number" },
      { name: "minimum", valueType: "number" },
    ])
  })

  it("rejects incomplete or mismatched expressions", () => {
    const invalid = {
      left: { kind: "argument", valueType: "number", name: "amount" },
      operator: ">",
      right: { kind: "constant", valueType: "string", value: "100" },
    } as const

    const result = validateConditionExpression(invalid)
    expect(result.ok).toBe(false)
    expect(result.details).toContain("Both operands must use the same value type.")
  })

  it("parses only supported expression shapes", () => {
    expect(parseConditionExpression({ operator: "contains" })).toBeNull()
    expect(parseConditionExpression(createDefaultConditionExpression())).not.toBeNull()
  })
})
