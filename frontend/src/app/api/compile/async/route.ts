import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/compile/async
 *
 * Proxies to the Rust backend POST /compile/async endpoint.
 * Returns HTTP 202 with { "jobId": "..." } immediately.
 * The client should then subscribe to GET /api/compile/:jobId/progress for SSE events.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080"

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
      { error: { code: "INVALID_PAYLOAD", message: "Request body must be a JSON object." } },
      { status: 400 }
    )
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/compile/async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data: unknown = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: { code: "UPSTREAM_ERROR", message: `Failed to reach backend: ${message}` } },
      { status: 502 }
    )
  }
}
