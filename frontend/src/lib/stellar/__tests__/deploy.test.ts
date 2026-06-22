import { describe, expect, it } from "vitest"
import { Address, xdr } from "@stellar/stellar-sdk"

import {
  bytesToHex,
  decodeWasmBase64,
  extractContractId,
  extractWasmHash,
  getStellarExpertContractUrl,
} from "@/lib/stellar/deploy"

describe("stellar deployment helpers", () => {
  it("builds Stellar Expert contract URLs for testnet and mainnet", () => {
    const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"

    expect(getStellarExpertContractUrl("testnet", contractId)).toBe(
      `https://stellar.expert/explorer/testnet/contract/${contractId}`
    )
    expect(getStellarExpertContractUrl("mainnet", contractId)).toBe(
      `https://stellar.expert/explorer/public/contract/${contractId}`
    )
  })

  it("decodes base64 WASM and encodes bytes as hex", () => {
    const bytes = decodeWasmBase64("AQID/w==")

    expect(Array.from(bytes)).toEqual([1, 2, 3, 255])
    expect(bytesToHex(bytes)).toBe("010203ff")
  })

  it("extracts a 32-byte WASM hash from an ScVal", () => {
    const hash = Uint8Array.from({ length: 32 }, (_, index) => index)
    const extracted = extractWasmHash(xdr.ScVal.scvBytes(Buffer.from(hash)))

    expect(bytesToHex(extracted)).toBe(bytesToHex(hash))
  })

  it("rejects missing or malformed WASM hash return values", () => {
    expect(() => extractWasmHash()).toThrow("did not return a WASM hash")
    expect(() => extractWasmHash(xdr.ScVal.scvBytes(Buffer.from([1, 2, 3])))).toThrow(
      "invalid WASM hash"
    )
  })

  it("extracts a contract ID from an address ScVal", () => {
    const contractId = Address.contract(Buffer.alloc(32, 7)).toString()

    expect(extractContractId(Address.fromString(contractId).toScVal())).toBe(contractId)
  })

  it("rejects invalid contract creation return values", () => {
    expect(() => extractContractId()).toThrow("did not return a contract ID")
    expect(() => extractContractId(xdr.ScVal.scvBytes(Buffer.from([1, 2, 3])))).toThrow("invalid contract ID")
  })
})
