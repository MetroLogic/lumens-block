import { describe, expect, it } from "vitest"

import { BLOCK_CATALOG, filterBlockCatalog, isEditorBlockType } from "./blockCatalog"

describe("blockCatalog", () => {
  it("returns every block for an empty query", () => {
    expect(filterBlockCatalog("")).toEqual(BLOCK_CATALOG)
  })

  it("matches blocks by name, description, and keyword", () => {
    expect(filterBlockCatalog("transfer")[0]?.type).toBe("Transfer")
    expect(filterBlockCatalog("boolean expression")[0]?.type).toBe("Condition")
    expect(filterBlockCatalog("signature")[0]?.type).toBe("Auth")
    expect(filterBlockCatalog("persist")[0]?.type).toBe("Storage")
  })

  it("supports short fuzzy subsequence matches", () => {
    expect(filterBlockCatalog("xfr")[0]?.type).toBe("Transfer")
    expect(filterBlockCatalog("evt")[0]?.type).toBe("Event")
  })

  it("returns no blocks for unrelated queries", () => {
    expect(filterBlockCatalog("postgres cron worker")).toEqual([])
  })

  it("recognizes editor block types without allowing Start", () => {
    expect(isEditorBlockType("Auth")).toBe(true)
    expect(isEditorBlockType("default")).toBe(false)
    expect(isEditorBlockType("Unknown")).toBe(false)
  })
})
