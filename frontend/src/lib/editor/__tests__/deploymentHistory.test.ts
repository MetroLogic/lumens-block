import { beforeEach, describe, expect, it } from "vitest"
import {
  addDeployment,
  clearDeployments,
  loadDeployments,
  removeDeployment,
  saveDeployments,
  type DeploymentRecord,
} from "../deploymentHistory"

const STORAGE_KEY = "lumens-block:deployments"

const record: DeploymentRecord = {
  id: "deploy_test_1",
  timestamp: "2026-08-10T12:00:00.000Z",
  network: "testnet",
  contractId: "CCONTRACT123456789",
  txHash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
}

function mockStorage() {
  const store = new Map<string, string>()
  ;(globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  }
}

describe("deploymentHistory", () => {
  beforeEach(() => {
    mockStorage()
    ;(globalThis as any).window.localStorage.removeItem(STORAGE_KEY)
  })

  it("returns an empty list when nothing is stored", () => {
    expect(loadDeployments()).toEqual([])
  })

  it("adds a deployment to the front of the list", () => {
    const records = addDeployment({
      network: "testnet",
      contractId: "CCONTRACT123456789",
      txHash: "abcdef",
    })
    expect(records).toHaveLength(1)
    expect(records[0].network).toBe("testnet")
    expect(records[0].contractId).toBe("CCONTRACT123456789")
    expect(records[0].txHash).toBe("abcdef")
    expect(records[0].id).toBeTruthy()
    expect(records[0].timestamp).toBeTruthy()
  })

  it("persists records across calls via localStorage", () => {
    addDeployment({
      network: "mainnet",
      contractId: "CMAIN2026",
      txHash: "txhash-1",
    })
    const loaded = loadDeployments()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].contractId).toBe("CMAIN2026")
    expect(loaded[0].network).toBe("mainnet")
  })

  it("keeps the newest records first", () => {
    addDeployment({ network: "testnet", contractId: "C_FIRST", txHash: "tx-f" })
    addDeployment({ network: "mainnet", contractId: "C_SECOND", txHash: "tx-s" })
    const records = loadDeployments()
    // addDeployment prepends, so the second added appears first
    expect(records[0].contractId).toBe("C_SECOND")
    expect(records[1].contractId).toBe("C_FIRST")
  })

  it("removes a record by id", () => {
    addDeployment({ network: "testnet", contractId: "C_KEEP", txHash: "tx-k" })
    const [added] = loadDeployments()
    const records = removeDeployment(added.id)
    expect(records).toHaveLength(0)
    expect(loadDeployments()).toHaveLength(0)
  })

  it("ignores malformed JSON in storage", () => {
    ;(globalThis as any).window.localStorage.setItem(STORAGE_KEY, "{invalid json")
    expect(loadDeployments()).toEqual([])
  })

  it("filters out malformed records", () => {
    ;(globalThis as any).window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([record, { id: 3, foo: "bar" }, null, "not-an-object"])
    )
    const records = loadDeployments()
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe("deploy_test_1")
  })

  it("clears all records", () => {
    addDeployment({ network: "testnet", contractId: "C_CLEAR", txHash: "tx-c" })
    clearDeployments()
    expect(loadDeployments()).toHaveLength(0)
  })

  it("saveDeployments persists the provided list", () => {
    saveDeployments([record])
    expect(loadDeployments()).toHaveLength(1)
    expect(loadDeployments()[0]).toEqual(record)
  })
})