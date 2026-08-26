import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------- Mock @stellar/stellar-sdk ----------
import { Networks } from "@stellar/stellar-sdk"

const mockHorizonServer = {
  loadAccount: vi.fn(),
}

const mockRpcServer = {
  simulateTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
  getAccount: vi.fn(),
}

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk"
  )
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn().mockImplementation(() => mockHorizonServer),
    },
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(() => mockRpcServer),
      Api: actual.SorobanRpc.Api,
    },
  }
})

// ---------- Mock @stellar/freighter-api ----------
const mockGetPublicKey = vi.fn()
const mockSignTransaction = vi.fn()

vi.mock("@stellar/freighter-api", () => ({
  getPublicKey: mockGetPublicKey,
  signTransaction: mockSignTransaction,
}))

// ---------- Mock fetch for compileContract ----------
const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof global.fetch

// ---------- Module under test ----------
import {
  getNetworkConfig,
  connectWallet,
  compileContract,
  CompileContractError,
  fetchWalletBalance,
  estimateDeploymentFee,
  type StellarNetwork,
} from "@/lib/stellar/deploy"

describe("getNetworkConfig", () => {
  it("returns testnet configuration", () => {
    const config = getNetworkConfig("testnet")
    expect(config).toEqual({
      horizonUrl: "https://horizon-testnet.stellar.org",
      rpcUrl: "https://soroban-testnet.stellar.org",
      passphrase: Networks.TESTNET,
    })
  })

  it("returns mainnet configuration", () => {
    const config = getNetworkConfig("mainnet")
    expect(config).toEqual({
      horizonUrl: "https://horizon.stellar.org",
      rpcUrl: "https://soroban.stellar.org",
      passphrase: Networks.PUBLIC,
    })
  })
})

describe("connectWallet", () => {
  beforeEach(() => {
    mockGetPublicKey.mockReset()
  })

  it("calls freighter.getPublicKey and returns the public key", async () => {
    mockGetPublicKey.mockResolvedValue("GBMOCKPUBLICKEY1234567890ABCDEF")
    const result = await connectWallet()
    expect(mockGetPublicKey).toHaveBeenCalledOnce()
    expect(result).toBe("GBMOCKPUBLICKEY1234567890ABCDEF")
  })

  it("throws a meaningful error when Freighter returns an empty key", async () => {
    mockGetPublicKey.mockResolvedValue("")
    await expect(connectWallet()).rejects.toThrow(
      "Freighter wallet returned empty public key"
    )
  })

  it("throws a meaningful error when Freighter rejects", async () => {
    mockGetPublicKey.mockRejectedValue(new Error("User rejected request"))
    await expect(connectWallet()).rejects.toThrow("User rejected request")
  })

  it("throws a generic error when Freighter is not installed", async () => {
    mockGetPublicKey.mockRejectedValue(
      new Error("Freighter is not installed")
    )
    await expect(connectWallet()).rejects.toThrow()
  })
})

describe("compileContract", () => {
  const mockGraph = {
    nodes: [{ id: "start", type: "default", data: { label: "Start" } }],
    edges: [],
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("sends the graph to /api/compile and returns the CompileResponse", async () => {
    const mockResponse: { wasm: string; sourceHash: string; sizeBytes: number } = {
      wasm: "AGFzbQEAAAAB",
      sourceHash: "abc123",
      sizeBytes: 128,
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await compileContract(mockGraph)
    expect(mockFetch).toHaveBeenCalledWith("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
    })
    expect(result.wasm).toBe("AGFzbQEAAAAB")
    expect(result.sizeBytes).toBe(128)
  })

  it("throws CompileContractError when the server returns an error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { code: "COMPILE_ERR", message: "Syntax error in graph" },
      }),
    })

    await expect(compileContract(mockGraph)).rejects.toThrow(
      CompileContractError
    )
    await expect(compileContract(mockGraph)).rejects.toThrow(
      /Syntax error in graph/
    )
  })

  it("throws CompileContractError with UNKNOWN code when no error body is returned", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    await expect(compileContract(mockGraph)).rejects.toThrow(
      CompileContractError
    )
  })

  it("throws when the network request fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))
    await expect(compileContract(mockGraph)).rejects.toThrow("Network error")
  })
})

describe("fetchWalletBalance", () => {
  beforeEach(() => {
    mockHorizonServer.loadAccount.mockReset()
  })

  it("returns the native XLM balance for a given public key", async () => {
    mockHorizonServer.loadAccount.mockResolvedValue({
      balances: [
        { asset_type: "native", balance: "42.5000000" },
        { asset_type: "credit_alphanum4", balance: "100.0000000" },
      ],
    })

    const balance = await fetchWalletBalance("GBPUBKEY", "testnet")
    expect(balance).toBe("42.5000000")
  })

  it("throws when no native balance is found", async () => {
    mockHorizonServer.loadAccount.mockResolvedValue({
      balances: [{ asset_type: "credit_alphanum4", balance: "100.0000000" }],
    })

    await expect(
      fetchWalletBalance("GBPUBKEY", "testnet")
    ).rejects.toThrow("Unable to fetch native XLM balance")
  })

  it("throws on Horizon server error", async () => {
    mockHorizonServer.loadAccount.mockRejectedValue(
      new Error("Horizon request failed")
    )
    await expect(
      fetchWalletBalance("GBPUBKEY", "testnet")
    ).rejects.toThrow("Horizon request failed")
  })
})

describe("estimateDeploymentFee", () => {
  // Valid Stellar testnet address for Operation.payment destination validation
  const VALID_KEY = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
  const mockGraph = { nodes: [], edges: [] }

  beforeEach(() => {
    mockHorizonServer.loadAccount.mockReset()
    mockRpcServer.simulateTransaction.mockReset()
  })

  it("returns a fee string on successful simulation", async () => {
    mockHorizonServer.loadAccount.mockResolvedValue({
      sequence: "123456",
      sequenceNumber: () => "123456",
      accountId: () => VALID_KEY,
      id: VALID_KEY,
      incrementSequenceNumber: () => {},
      signatureHint: () => Buffer.from([]),
    })
    mockRpcServer.simulateTransaction.mockResolvedValue({
      minResourceFee: "500000",
    })

    const fee = await estimateDeploymentFee(mockGraph, "testnet", VALID_KEY)
    expect(fee).toBe("0.5000000")
  })

  it("throws on simulation error", async () => {
    mockHorizonServer.loadAccount.mockResolvedValue({
      sequence: "123456",
      sequenceNumber: () => "123456",
      accountId: () => VALID_KEY,
      id: VALID_KEY,
      incrementSequenceNumber: () => {},
      signatureHint: () => Buffer.from([]),
    })
    mockRpcServer.simulateTransaction.mockResolvedValue({
      error: "Simulation failed",
    })

    await expect(
      estimateDeploymentFee(mockGraph, "testnet", VALID_KEY)
    ).rejects.toThrow("Simulation failed")
  })

  it("throws when Horizon account load fails", async () => {
    mockHorizonServer.loadAccount.mockRejectedValue(
      new Error("Account not found")
    )

    await expect(
      estimateDeploymentFee(mockGraph, "testnet", VALID_KEY)
    ).rejects.toThrow("Account not found")
  })
})