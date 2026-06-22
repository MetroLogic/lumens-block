import { describe, expect, it } from "vitest"

import { getDefaultEdgeLabel, normalizeEdgeLabel } from "./edgeLabels"

describe("getDefaultEdgeLabel", () => {
  it("maps named condition and transfer handles to readable labels", () => {
    expect(getDefaultEdgeLabel("condition-true")).toBe("true")
    expect(getDefaultEdgeLabel("condition-false")).toBe("false")
    expect(getDefaultEdgeLabel("transfer-success")).toBe("success")
    expect(getDefaultEdgeLabel("transfer-failure")).toBe("failure")
  })

  it("returns an empty label for unnamed handles", () => {
    expect(getDefaultEdgeLabel(null)).toBe("")
    expect(getDefaultEdgeLabel("source")).toBe("")
  })
})

describe("normalizeEdgeLabel", () => {
  it("trims, compacts, and caps labels", () => {
    expect(normalizeEdgeLabel("  branch   label  ")).toBe("branch label")
    expect(normalizeEdgeLabel("a".repeat(40))).toBe("a".repeat(32))
  })

  it("drops blank and non-string labels", () => {
    expect(normalizeEdgeLabel("   ")).toBeUndefined()
    expect(normalizeEdgeLabel(42)).toBeUndefined()
  })
})
