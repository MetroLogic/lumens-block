"use client"

import { useCallback, useRef, useState } from "react"

/** Maximum number of snapshots retained in the undo history. */
export const MAX_HISTORY_LENGTH = 50

/**
 * Generic undo/redo history hook built on past/future snapshot stacks.
 *
 * The hook stores immutable snapshots (deep-cloned) of whatever value you
 * push.  Call `push` whenever the canvas changes; `undo` / `redo` move
 * snapshots between the two stacks and update `currentSnapshot` so the
 * consumer can react to it.
 *
 * @example
 * const { undo, redo, canUndo, canRedo, push, clear, currentSnapshot } = useHistory(initialGraph)
 */
export function useHistory<T>(initialSnapshot: T) {
  const [past, setPast] = useState<T[]>([])
  const [future, setFuture] = useState<T[]>([])
  const [currentSnapshot, setCurrentSnapshot] = useState<T>(initialSnapshot)
  const currentRef = useRef<T>(initialSnapshot)

  const push = useCallback((snapshot: T) => {
    currentRef.current = snapshot
    setCurrentSnapshot(snapshot)
    setPast((prev) => [...prev.slice(-(MAX_HISTORY_LENGTH - 1)), snapshot])
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    setPast(([latest, ...rest]) => {
      if (latest === undefined) {
        // past is empty — no-op
        return []
      }
      setFuture((prev) => [currentRef.current, ...prev])
      currentRef.current = latest
      setCurrentSnapshot(latest)
      return rest
    })
  }, [])

  const redo = useCallback(() => {
    setFuture(([latest, ...rest]) => {
      if (latest === undefined) {
        // future is empty — no-op
        return []
      }
      setPast((prev) => [...prev.slice(-(MAX_HISTORY_LENGTH - 1)), currentRef.current])
      currentRef.current = latest
      setCurrentSnapshot(latest)
      return rest
    })
  }, [])

  const clear = useCallback((snapshot: T) => {
    currentRef.current = snapshot
    setCurrentSnapshot(snapshot)
    setPast([])
    setFuture([])
  }, [])

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    push,
    clear,
    currentSnapshot,
  }
}