import { describe, expect, it, beforeEach, vi, afterEach } from "vitest"
import { getStoredNetwork, storeNetwork, STORAGE_KEY } from "../NetworkSelector"

// Mock localStorage since vitest environment is "node"
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => storage.clear(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getStoredNetwork", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredNetwork()).toBeNull()
  })

  it("returns 'testnet' when testnet is stored", () => {
    storage.set(STORAGE_KEY, "testnet")
    expect(getStoredNetwork()).toBe("testnet")
  })

  it("returns 'mainnet' when mainnet is stored", () => {
    storage.set(STORAGE_KEY, "mainnet")
    expect(getStoredNetwork()).toBe("mainnet")
  })

  it("returns null for invalid stored values", () => {
    storage.set(STORAGE_KEY, "ropsten")
    expect(getStoredNetwork()).toBeNull()
  })

  it("returns null when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(getStoredNetwork()).toBeNull()
  })
})

describe("storeNetwork", () => {
  it("persists the selected network", () => {
    storeNetwork("mainnet")
    expect(storage.get(STORAGE_KEY)).toBe("mainnet")
  })

  it("overwrites an existing selection", () => {
    storeNetwork("testnet")
    storeNetwork("mainnet")
    expect(storage.get(STORAGE_KEY)).toBe("mainnet")
  })

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(() => storeNetwork("testnet")).not.toThrow()
  })
})