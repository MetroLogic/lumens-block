import { describe, expect, it } from "vitest"
import { xdr } from "@stellar/stellar-sdk"

import { buildInspectorGraph, parseContractSpecMethods, validateContractId } from "./contractInspector"

describe("validateContractId", () => {
  it("accepts valid Stellar contract IDs", () => {
    expect(validateContractId("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM").ok).toBe(true)
  })

  it("rejects malformed contract IDs", () => {
    const result = validateContractId("not-a-contract")
    expect(result.ok).toBe(false)
  })
})

describe("buildInspectorGraph", () => {
  it("creates read-only graph nodes for methods and storage", () => {
    const graph = buildInspectorGraph({
      wasmHash: "a".repeat(64),
      methods: [{ name: "increment", inputs: ["by: U32"], outputs: ["U32"] }],
      storageEntries: [{ key: "counter", value: "7" }],
    })

    expect(graph.nodes.map((node) => node.id)).toEqual(["contract", "method-0", "storage-0"])
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes.every((node) => node.draggable === false)).toBe(true)
  })
})

describe("parseContractSpecMethods", () => {
  it("extracts function specs from the contractspecv0 custom section", () => {
    const specEntry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: Buffer.from("Increment counter"),
        name: Buffer.from("increment"),
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: Buffer.from("amount"),
            name: Buffer.from("by"),
            type: xdr.ScSpecTypeDef.scSpecTypeU32(),
          }),
        ],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeU32()],
      })
    )
    const wasm = buildWasmWithContractSpec(specEntry.toXDR())

    expect(parseContractSpecMethods(wasm)).toEqual([
      {
        name: "increment",
        doc: "Increment counter",
        inputs: ["by: U32"],
        outputs: ["U32"],
      },
    ])
  })
})

function buildWasmWithContractSpec(spec: Buffer): Uint8Array {
  const name = Buffer.from("contractspecv0")
  const payload = Buffer.concat([encodeUleb128(name.length), name, spec])

  return Buffer.concat([
    Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from([0x00]),
    encodeUleb128(payload.length),
    payload,
  ])
}

function encodeUleb128(value: number): Buffer {
  const bytes: number[] = []
  let remaining = value

  do {
    let byte = remaining & 0x7f
    remaining >>= 7
    if (remaining !== 0) byte |= 0x80
    bytes.push(byte)
  } while (remaining !== 0)

  return Buffer.from(bytes)
}
