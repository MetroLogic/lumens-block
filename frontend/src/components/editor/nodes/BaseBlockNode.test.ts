import { describe, expect, it } from "vitest"

import { blockNodeThemes } from "./BaseBlockNode"

describe("blockNodeThemes", () => {
  it("defines distinct renderers for every executable block type", () => {
    expect(Object.keys(blockNodeThemes).sort()).toEqual([
      "Auth",
      "Condition",
      "Event",
      "Storage",
      "Transfer",
    ])
  })

  it("gives each block type an icon, colour header, and accessible label text", () => {
    const headers = new Set<string>()

    for (const theme of Object.values(blockNodeThemes)) {
      expect(theme.icon).toBeTruthy()
      expect(theme.description.length).toBeGreaterThan(8)
      expect(theme.headerClassName).toContain("text-white")
      headers.add(theme.headerClassName)
    }

    expect(headers.size).toBe(Object.keys(blockNodeThemes).length)
  })

  it("displays schema-backed config values for configurable nodes", () => {
    expect(blockNodeThemes.Transfer.fields.map((field) => field.key)).toEqual(["token"])
    expect(blockNodeThemes.Storage.fields.map((field) => field.key)).toEqual(["storageKey"])
    expect(blockNodeThemes.Event.fields.map((field) => field.key)).toEqual(["eventName"])
    expect(blockNodeThemes.Condition.fields.map((field) => field.key)).toEqual(["condition"])
  })
})
