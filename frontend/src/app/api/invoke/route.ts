import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/invoke
 *
 * Thin proxy that forwards the request body to the Rust backend POST /invoke
 * endpoint and streams the response back to the caller.
 *
 * Expected body shape (mirrors the Rust InvokeRequest):
 * {
 *   contractId:    string          // deployed contract ID (C...)
 *   network:       string          // "testnet" | "mainnet"
 *   functionName:  string          // valid Rust identifier
 *   args:          Array<{         // optional
 *     type:  "Address" | "i128" | "bool" | "Symbol"
 *     value: string
 *   }>
 * }
 */

const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8080"

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: "MALFORMED_JSON", message: "Request body is not valid JSON." } },
      { status: 400 }
    )
  }

  if (!isPlainObject(body)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PAYLOAD",
          message: "Request body must be a non-empty JSON object.",
        },
      },
      { status: 400 }
    )
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data: unknown = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[api/invoke] upstream error:", message)
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: `Failed to reach backend: ${message}`,
        },
      },
      { status: 502 }
    )
  }
}
