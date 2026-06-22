import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchSacTokenMetadata,
  formatAssetLabel,
  validateTransferAssetSelection,
  type TransferAssetSelection,
} from "./assets"

const VALID_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("validateTransferAssetSelection", () => {
  it("accepts native XLM without a token address", () => {
    expect(validateTransferAssetSelection({ assetType: "native" })).toEqual({ ok: true })
  })

  it("requires a SAC contract address for custom tokens", () => {
    expect(validateTransferAssetSelection({ assetType: "sac" })).toEqual({
      ok: false,
      error: "Enter a SAC contract address.",
    })
  })

  it("rejects non-contract strkeys", () => {
    const result = validateTransferAssetSelection({
      assetType: "sac",
      token: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain("valid Stellar contract address")
  })

  it("accepts Stellar contract strkeys", () => {
    expect(validateTransferAssetSelection({ assetType: "sac", token: VALID_CONTRACT })).toEqual({
      ok: true,
    })
  })
})

describe("formatAssetLabel", () => {
  it("renders native XLM as the default", () => {
    expect(formatAssetLabel()).toBe("XLM")
    expect(formatAssetLabel({ assetType: "native" })).toBe("XLM")
  })

  it("renders fetched custom token metadata", () => {
    const selection: TransferAssetSelection = {
      assetType: "sac",
      token: VALID_CONTRACT,
      assetSymbol: "USDC",
      assetName: "USD Coin",
    }

    expect(formatAssetLabel(selection)).toBe("USDC (USD Coin)")
  })

  it("falls back to a shortened contract address", () => {
    expect(formatAssetLabel({ assetType: "sac", token: VALID_CONTRACT })).toBe("CAAAAA...AAD2KM")
  })
})

describe("fetchSacTokenMetadata", () => {
  it("calls the metadata API for valid SAC contract addresses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: "USDC", name: "USD Coin" }),
    } as Response)

    await expect(fetchSacTokenMetadata(VALID_CONTRACT)).resolves.toEqual({
      symbol: "USDC",
      name: "USD Coin",
    })
    expect(fetchMock).toHaveBeenCalledWith(`/api/token-metadata?token=${VALID_CONTRACT}`)
  })

  it("throws inline validation errors before calling the metadata API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")

    await expect(fetchSacTokenMetadata("not-a-contract")).rejects.toThrow(
      "Enter a valid Stellar contract address"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
