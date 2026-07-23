import { beforeEach, describe, expect, it, vi } from "vitest"
import { Asset, Networks, nativeToScVal } from "@stellar/stellar-sdk"

const simulateTransaction = vi.fn()

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk"
  )
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(() => ({
        simulateTransaction,
      })),
      Api: actual.SorobanRpc.Api,
    },
  }
})

import {
  fetchTokenMetadata,
  getNativeXlmAsset,
  isValidContractAddress,
  TokenMetadataError,
} from "@/lib/stellar/tokenMetadata"

const NATIVE_SAC = Asset.native().contractId(Networks.TESTNET)

function successSim(value: string) {
  return {
    id: "sim",
    latestLedger: 1,
    events: [],
    transactionData: {},
    minResourceFee: "0",
    result: {
      retval: nativeToScVal(value, { type: "string" }),
    },
  }
}

describe("isValidContractAddress", () => {
  it("accepts a valid native XLM SAC address", () => {
    expect(isValidContractAddress(NATIVE_SAC)).toBe(true)
  })

  it("rejects empty and malformed addresses", () => {
    expect(isValidContractAddress("")).toBe(false)
    expect(isValidContractAddress("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")).toBe(
      false
    )
    expect(isValidContractAddress("not-an-address")).toBe(false)
  })

  it("trims whitespace before validating", () => {
    expect(isValidContractAddress(`  ${NATIVE_SAC}  `)).toBe(true)
  })
})

describe("getNativeXlmAsset", () => {
  it("returns XLM kind with Testnet native SAC id", () => {
    const asset = getNativeXlmAsset()
    expect(asset).toEqual({
      kind: "xlm",
      contractId: NATIVE_SAC,
      symbol: "XLM",
      name: "native",
    })
  })
})

describe("fetchTokenMetadata", () => {
  beforeEach(() => {
    simulateTransaction.mockReset()
  })

  it("throws TokenMetadataError for invalid addresses without calling RPC", async () => {
    await expect(fetchTokenMetadata("bad")).rejects.toBeInstanceOf(TokenMetadataError)
    await expect(fetchTokenMetadata("bad")).rejects.toThrow("Invalid contract address")
    expect(simulateTransaction).not.toHaveBeenCalled()
  })

  it("returns symbol and name from successful simulations", async () => {
    simulateTransaction
      .mockResolvedValueOnce(successSim("USDC"))
      .mockResolvedValueOnce(successSim("USD Coin"))

    const meta = await fetchTokenMetadata(NATIVE_SAC)
    expect(meta).toEqual({ symbol: "USDC", name: "USD Coin" })
    expect(simulateTransaction).toHaveBeenCalledTimes(2)
  })

  it("maps simulation errors to TokenMetadataError", async () => {
    simulateTransaction.mockResolvedValue({
      id: "sim",
      latestLedger: 1,
      error: "contract not found on network",
    })

    await expect(fetchTokenMetadata(NATIVE_SAC)).rejects.toBeInstanceOf(TokenMetadataError)
    await expect(fetchTokenMetadata(NATIVE_SAC)).rejects.toThrow(/Contract not found|metadata|SAC|Unable/i)
  })
})
