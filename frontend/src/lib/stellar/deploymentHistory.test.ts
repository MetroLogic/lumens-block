import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  appendDeploymentRecord,
  DEPLOYMENT_HISTORY_LIMIT,
  DEPLOYMENT_HISTORY_STORAGE_KEY,
  getStellarExpertContractUrl,
  getStellarExpertTransactionUrl,
  readDeploymentHistory,
  removeDeploymentRecord,
  writeDeploymentHistory,
  type DeploymentRecord,
} from "./deploymentHistory"

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe("deploymentHistory", () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.123456789)
      .mockReturnValueOnce(0.987654321)
      .mockReturnValue(0.456789123)
  })

  it("appends successful deployment records to local storage", () => {
    const record = appendDeploymentRecord(
      {
        network: "testnet",
        contractId: "CCONTRACT123",
        transactionHash: "abcd1234",
        deployer: "GDEPLOYER",
        estimatedFee: "0.0000100",
        wasmHash: "wasmhash",
        sourceHash: "sourcehash",
        sizeBytes: 2048,
        message: "Deployed contract",
      },
      storage
    )

    const records = readDeploymentHistory(storage)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      id: record.id,
      network: "testnet",
      contractId: "CCONTRACT123",
      transactionHash: "abcd1234",
      deployer: "GDEPLOYER",
      estimatedFee: "0.0000100",
      wasmHash: "wasmhash",
      sourceHash: "sourcehash",
      sizeBytes: 2048,
      message: "Deployed contract",
    })
  })

  it("removes individual records without clearing the full history", () => {
    const first = appendDeploymentRecord({ network: "testnet", transactionHash: "first" }, storage)
    const second = appendDeploymentRecord({ network: "mainnet", transactionHash: "second" }, storage)

    const remaining = removeDeploymentRecord(first.id, storage)

    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
  })

  it("builds Stellar Expert links for the correct network", () => {
    const record: DeploymentRecord = {
      id: "deployment_1",
      createdAt: "2026-06-22T00:00:00.000Z",
      network: "mainnet",
      contractId: "CCONTRACT123",
      transactionHash: "abcdef",
    }

    expect(getStellarExpertContractUrl(record)).toBe(
      "https://stellar.expert/explorer/mainnet/contract/CCONTRACT123"
    )
    expect(getStellarExpertTransactionUrl(record)).toBe(
      "https://stellar.expert/explorer/mainnet/tx/abcdef"
    )
  })

  it("ignores malformed persisted entries and caps history", () => {
    const tooManyRecords = Array.from({ length: DEPLOYMENT_HISTORY_LIMIT + 2 }, (_, index) => ({
      id: `deployment_${index}`,
      createdAt: "2026-06-22T00:00:00.000Z",
      network: index % 2 === 0 ? "testnet" : "mainnet",
      transactionHash: `hash_${index}`,
    }))

    storage.setItem(
      DEPLOYMENT_HISTORY_STORAGE_KEY,
      JSON.stringify([
        { id: "bad", createdAt: "2026-06-22T00:00:00.000Z", network: "devnet" },
        ...tooManyRecords,
      ])
    )

    const records = readDeploymentHistory(storage)

    expect(records).toHaveLength(DEPLOYMENT_HISTORY_LIMIT)
    expect(records[0].id).toBe("deployment_0")
  })

  it("serializes only normalized deployment records", () => {
    const records = writeDeploymentHistory(
      [
        {
          id: "deployment_good",
          createdAt: "2026-06-22T00:00:00.000Z",
          network: "testnet",
          transactionHash: "good",
        },
        {
          id: "",
          createdAt: "2026-06-22T00:00:00.000Z",
          network: "testnet",
          transactionHash: "missing-id",
        } as DeploymentRecord,
      ],
      storage
    )

    expect(records).toHaveLength(1)
    expect(JSON.parse(storage.getItem(DEPLOYMENT_HISTORY_STORAGE_KEY) ?? "[]")).toHaveLength(1)
  })
})
