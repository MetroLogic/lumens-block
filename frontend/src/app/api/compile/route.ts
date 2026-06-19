import { NextRequest, NextResponse } from "next/server"

import { compileGraphToWasm } from "@/lib/compile/compiler"
import { validateContractGraph } from "@/lib/compile/validate"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  let rawBody: unknown
  let byteLength = 0

  try {
    const text = await request.text()
    byteLength = Buffer.byteLength(text, "utf8")

    if (text.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PAYLOAD",
            message: "Request body must be a JSON object with nodes and edges.",
          },
        },
        { status: 400 }
      )
    }

    rawBody = JSON.parse(text)
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "MALFORMED_JSON",
          message: "Request body is not valid JSON.",
        },
      },
      { status: 400 }
    )
  }

  const validation = validateContractGraph(rawBody, byteLength)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const result = await compileGraphToWasm(validation.graph)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    wasm: result.data.wasm,
    sourceHash: result.data.sourceHash,
    sizeBytes: result.data.sizeBytes,
  })
}
