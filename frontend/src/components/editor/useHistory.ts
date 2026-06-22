import { useCallback, useReducer } from "react"
import { createHistoryState, historyReducer, type GraphSnapshot } from "./historyReducer"

export function useHistory(initialSnapshot: GraphSnapshot) {
  const [state, dispatch] = useReducer(historyReducer, initialSnapshot, createHistoryState)

  const commit = useCallback((nextSnapshot: GraphSnapshot) => {
    dispatch({ type: "commit", snapshot: nextSnapshot })
  }, [])

  const commitFrom = useCallback((base: GraphSnapshot, nextSnapshot: GraphSnapshot) => {
    dispatch({ type: "commitFrom", base, snapshot: nextSnapshot })
  }, [])

  const update = useCallback((nextSnapshot: GraphSnapshot) => {
    dispatch({ type: "update", snapshot: nextSnapshot })
  }, [])

  const replace = useCallback((nextSnapshot: GraphSnapshot) => {
    dispatch({ type: "replace", snapshot: nextSnapshot })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: "undo" })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: "redo" })
  }, [])

  return {
    nodes: state.present.nodes,
    edges: state.present.edges,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    commitFrom,
    update,
    replace,
    undo,
    redo,
  }
}
