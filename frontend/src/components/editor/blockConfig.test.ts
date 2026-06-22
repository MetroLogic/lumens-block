import { describe, expect, it } from "vitest"

import { getConfigFields, mergeBlockConfig } from "./blockConfig"

describe("getConfigFields", () => {
  it("returns schema-backed fields for configurable block types", () => {
    expect(getConfigFields("Storage").map((field) => field.key)).toEqual(["storageKey"])
    expect(getConfigFields("Condition").map((field) => field.key)).toEqual(["condition"])
  })

  it("returns no parameter fields for Start blocks", () => {
    expect(getConfigFields("default")).toEqual([])
  })
})

describe("mergeBlockConfig", () => {
  it("updates labels while preserving existing params", () => {
    const next = mergeBlockConfig(
      { label: "Lock", params: { storageKey: "escrow" } },
      { label: "Lock funds" }
    )

    expect(next).toEqual({ label: "Lock funds", params: { storageKey: "escrow" } })
  })

  it("drops empty string params so graph payloads stay compact", () => {
    const next = mergeBlockConfig(
      { label: "Storage", params: { storageKey: "escrow" } },
      { params: { storageKey: "   " } }
    )

    expect(next).toEqual({ label: "Storage" })
  })
})
