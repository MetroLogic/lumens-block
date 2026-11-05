import { useCallback, useMemo, useRef, useState } from "react"
import type { Node, Edge } from "reactflow"

export interface GraphSnapshot {
  nodes: Node[]
  edges: Edge[]
}

export interface UseGraphHistoryReturn {
  snapshot: GraphSnapshot
  push: (next: GraphSnapshot) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: (newInitial?: GraphSnapshot) => void
}

export const DEFAULT_MAX_HISTORY_DEPTH = 100

/** Deep-clone a snapshot so mutations to live state can never corrupt history. */
export function cloneSnapshot(snap: GraphSnapshot): GraphSnapshot {
  return JSON.parse(JSON.stringify(snap))
}

/**
 * Pure class managing the past/current/future stacks for graph history.
 * Maintains deep-cloned snapshots and evicts oldest past entry when cap is exceeded.
 */
export class GraphHistory {
  private past: GraphSnapshot[] = []
  private future: GraphSnapshot[] = []
  private current: GraphSnapshot
  private maxDepth: number

  constructor(initial: GraphSnapshot, maxDepth: number = DEFAULT_MAX_HISTORY_DEPTH) {
    this.current = cloneSnapshot(initial)
    this.maxDepth = maxDepth
  }

  get snapshot(): GraphSnapshot {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get pastLength(): number {
    return this.past.length
  }

  get futureLength(): number {
    return this.future.length
  }

  push(next: GraphSnapshot): void {
    this.past.push(cloneSnapshot(this.current))
    if (this.past.length > this.maxDepth) {
      this.past.shift()
    }
    this.future = []
    this.current = cloneSnapshot(next)
  }

  undo(): GraphSnapshot | undefined {
    if (this.past.length === 0) return undefined
    const previous = this.past.pop()!
    this.future.push(cloneSnapshot(this.current))
    this.current = previous
    return this.current
  }

  redo(): GraphSnapshot | undefined {
    if (this.future.length === 0) return undefined
    const next = this.future.pop()!
    this.past.push(cloneSnapshot(this.current))
    this.current = next
    return this.current
  }

  clear(newInitial?: GraphSnapshot): void {
    this.past = []
    this.future = []
    if (newInitial) {
      this.current = cloneSnapshot(newInitial)
    }
  }
}

/**
 * A React hook that maintains an undo/redo history stack for a graph.
 *
 * - `push(next)` records current snapshot in past, clears future, sets current to next.
 * - `undo()` moves current to future and pops from past.
 * - `redo()` moves current to past and pops from future.
 * - Stack is capped at `maxDepth` (default: 100).
 * - All snapshots are deep-cloned.
 * - History is session-only (not saved to localStorage).
 */
export function useGraphHistory(
  initial: GraphSnapshot,
  maxDepth: number = DEFAULT_MAX_HISTORY_DEPTH
): UseGraphHistoryReturn {
  const historyRef = useRef<GraphHistory | null>(null)
  if (!historyRef.current) {
    historyRef.current = new GraphHistory(initial, maxDepth)
  }

  const [snapshot, setSnapshot] = useState<GraphSnapshot>(() => historyRef.current!.snapshot)
  const [, setTick] = useState(0)

  const push = useCallback((next: GraphSnapshot) => {
    historyRef.current!.push(next)
    setSnapshot(historyRef.current!.snapshot)
    setTick((t) => t + 1)
  }, [])

  const undo = useCallback((): GraphSnapshot | undefined => {
    const popped = historyRef.current!.undo()
    if (popped) {
      setSnapshot(popped)
      setTick((t) => t + 1)
    }
    return popped
  }, [])

  const redo = useCallback((): GraphSnapshot | undefined => {
    const next = historyRef.current!.redo()
    if (next) {
      setSnapshot(next)
      setTick((t) => t + 1)
    }
    return next
  }, [])

  const clear = useCallback((newInitial?: GraphSnapshot) => {
    historyRef.current!.clear(newInitial)
    if (newInitial) {
      setSnapshot(historyRef.current!.snapshot)
    }
    setTick((t) => t + 1)
  }, [])

  const canUndo = historyRef.current.canUndo
  const canRedo = historyRef.current.canRedo

  return useMemo(
    () => ({
      snapshot,
      push,
      undo: undo as () => void,
      redo: redo as () => void,
      canUndo,
      canRedo,
      clear,
    }),
    [snapshot, push, undo, redo, canUndo, canRedo, clear]
  )
}
