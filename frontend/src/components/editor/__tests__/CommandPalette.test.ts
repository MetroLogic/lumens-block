import { describe, it, expect } from "vitest"
import { fuzzyMatch } from "../CommandPalette"

describe("fuzzyMatch", () => {
  it("returns true for empty query", () => {
    expect(fuzzyMatch("", "anything")).toBe(true)
  })

  it("matches exact case-insensitive text", () => {
    expect(fuzzyMatch("transfer", "Transfer")).toBe(true)
  })

  it("matches partial characters in order", () => {
    expect(fuzzyMatch("trf", "Transfer")).toBe(true)
    expect(fuzzyMatch("stor", "Storage")).toBe(true)
    expect(fuzzyMatch("cnd", "Condition")).toBe(true)
  })

  it("matches across word boundaries", () => {
    expect(fuzzyMatch("evt", "Event")).toBe(true)
    expect(fuzzyMatch("auth", "Auth")).toBe(true)
  })

  it("returns false when characters are out of order", () => {
    expect(fuzzyMatch("rt", "Transfer")).toBe(false)
  })

  it("returns false when query has characters not in target", () => {
    expect(fuzzyMatch("xyz", "Event")).toBe(false)
  })

  it("matches description text", () => {
    expect(fuzzyMatch("condition", "Branch logic based on a condition")).toBe(true)
    expect(fuzzyMatch("send", "Send tokens or assets")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(fuzzyMatch("TRANSFER", "Transfer")).toBe(true)
    expect(fuzzyMatch("transfer", "TRANSFER")).toBe(true)
  })
})