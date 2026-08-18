import { NextRequest } from "next/server"

/**
 * GET /api/compile/[jobId]/progress
 *
 * Proxies the SSE stream from the Rust backend GET /compile/:job_id/progress.
 * Streams text/event-stream directly to the browser client.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080"

export const runtime = "nodejs"
// No maxDuration cap — SSE streams are long-lived by design.

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<Response> {
  const { jobId } = params

  if (!jobId || typeof jobId !== "string") {
    return new Response(
      JSON.stringify({ error: { code: "MISSING_JOB_ID", message: "jobId is required." } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(`${BACKEND_URL}/compile/${encodeURIComponent(jobId)}/progress`, {
      headers: { Accept: "text/event-stream" },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: { code: "UPSTREAM_ERROR", message } }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "")
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    })
  }

  // Stream the response body verbatim back to the browser
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
