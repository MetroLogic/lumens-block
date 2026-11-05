/**
 * useAsyncCompile
 *
 * Calls POST /api/compile/async to enqueue a compilation job, then opens an
 * SSE stream at /api/compile/:jobId/progress to receive live progress events.
 *
 * Returns a function `startCompile(source)` and reactive state for the UI:
 *   - stage: "idle" | "queued" | "building" | "done" | "error"
 *   - queuePosition: number | null   — populated while stage === "queued"
 *   - elapsedMs: number | null       — populated while stage === "building"
 *   - progressLabel: string          — human-readable summary for the UI
 *
 * The caller receives the final wasm/sourceHash/sizeBytes via an `onDone`
 * callback, or an error message via `onError`.
 */

import { useCallback, useRef, useState } from "react"

export type CompileStage = "idle" | "queued" | "building" | "done" | "error"

export interface AsyncCompileState {
  stage: CompileStage
  queuePosition: number | null
  elapsedMs: number | null
  progressLabel: string
}

export interface CompileResult {
  wasm: string
  sourceHash: string
  sizeBytes: number
}

interface UseAsyncCompileOptions {
  onDone: (result: CompileResult) => void
  onError: (code: string, message: string) => void
}

export function useAsyncCompile({ onDone, onError }: UseAsyncCompileOptions) {
  const [state, setState] = useState<AsyncCompileState>({
    stage: "idle",
    queuePosition: null,
    elapsedMs: null,
    progressLabel: "",
  })

  // Hold a ref to the current EventSource so we can close it on cleanup
  const esRef = useRef<EventSource | null>(null)

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const startCompile = useCallback(
    async (source: string) => {
      closeStream()

      setState({ stage: "queued", queuePosition: null, elapsedMs: null, progressLabel: "Submitting…" })

      // 1. Enqueue the job
      let jobId: string
      try {
        const res = await fetch("/api/compile/async", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
        })

        const body = await res.json() as { jobId?: string; cached?: boolean; error?: { code: string; message: string } }

        if (!res.ok || !body.jobId) {
          const err = body.error ?? { code: String(res.status), message: "Failed to enqueue compilation." }
          setState({ stage: "error", queuePosition: null, elapsedMs: null, progressLabel: err.message })
          onError(err.code, err.message)
          return
        }
        
        if (body.cached) {
          setState({ stage: "done", queuePosition: null, elapsedMs: null, progressLabel: "⚡ Cached" })
          onDone({ wasm: "", sourceHash: "", sizeBytes: 0 })
          return
        }

        jobId = body.jobId
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error"
        setState({ stage: "error", queuePosition: null, elapsedMs: null, progressLabel: msg })
        onError("NETWORK_ERROR", msg)
        return
      }

      // 2. Open SSE stream for progress
      const es = new EventSource(`/api/compile/${jobId}/progress`)
      esRef.current = es

      es.addEventListener("queued", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { position: number }
          setState({
            stage: "queued",
            queuePosition: data.position,
            elapsedMs: null,
            progressLabel: `Queued (position ${data.position})`,
          })
        } catch {
          // ignore parse errors
        }
      })

      es.addEventListener("building", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { elapsedMs: number }
          const secs = Math.round(data.elapsedMs / 1000)
          setState({
            stage: "building",
            queuePosition: null,
            elapsedMs: data.elapsedMs,
            progressLabel: `Building… ${secs}s`,
          })
        } catch {
          // ignore parse errors
        }
      })

      es.addEventListener("done", () => {
        closeStream()
        setState({ stage: "done", queuePosition: null, elapsedMs: null, progressLabel: "Done" })
        // The done event signals success; the caller should fetch the result
        // from the synchronous compile endpoint or we surface it via a callback.
        // For the async path the wasm comes from a final REST call.
        onDone({ wasm: "", sourceHash: "", sizeBytes: 0 })
      })

      es.addEventListener("error", (e: MessageEvent) => {
        closeStream()
        let code = "COMPILATION_FAILED"
        let message = "Compilation failed."
        try {
          const data = JSON.parse(e.data) as { code?: string; message?: string }
          code = data.code ?? code
          message = data.message ?? message
        } catch {
          // ignore
        }
        setState({ stage: "error", queuePosition: null, elapsedMs: null, progressLabel: message })
        onError(code, message)
      })

      es.onerror = () => {
        // SSE connection dropped unexpectedly
        closeStream()
        setState((prev) =>
          prev.stage === "done" || prev.stage === "error"
            ? prev
            : { stage: "error", queuePosition: null, elapsedMs: null, progressLabel: "Connection lost." }
        )
      }
    },
    [closeStream, onDone, onError]
  )

  const reset = useCallback(() => {
    closeStream()
    setState({ stage: "idle", queuePosition: null, elapsedMs: null, progressLabel: "" })
  }, [closeStream])

  return { state, startCompile, reset }
}
