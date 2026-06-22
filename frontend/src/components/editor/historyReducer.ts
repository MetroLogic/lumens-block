import type { Edge, Node } from "reactflow"

export interface GraphSnapshot {
  nodes: Node[]
  edges: Edge[]
}

export interface HistoryState {
  past: GraphSnapshot[]
  present: GraphSnapshot
  future: GraphSnapshot[]
}

export type HistoryAction =
  | { type: "commit"; snapshot: GraphSnapshot }
  | { type: "commitFrom"; base: GraphSnapshot; snapshot: GraphSnapshot }
  | { type: "update"; snapshot: GraphSnapshot }
  | { type: "replace"; snapshot: GraphSnapshot }
  | { type: "undo" }
  | { type: "redo" }

const MAX_HISTORY_STEPS = 50

function cloneNode(node: Node): Node {
  return {
    ...node,
    position: { ...node.position },
    data: { ...(node.data ?? {}) },
  }
}

function cloneEdge(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
  }
}

export function cloneSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map(cloneNode),
    edges: snapshot.edges.map(cloneEdge),
  }
}

export function areSnapshotsEqual(left: GraphSnapshot, right: GraphSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createHistoryState(snapshot: GraphSnapshot): HistoryState {
  return {
    past: [],
    present: cloneSnapshot(snapshot),
    future: [],
  }
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit": {
      const next = cloneSnapshot(action.snapshot)
      if (areSnapshotsEqual(state.present, next)) return state

      return {
        past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY_STEPS),
        present: next,
        future: [],
      }
    }
    case "commitFrom": {
      const base = cloneSnapshot(action.base)
      const next = cloneSnapshot(action.snapshot)
      if (areSnapshotsEqual(base, next)) {
        return {
          ...state,
          present: next,
        }
      }

      return {
        past: [...state.past, base].slice(-MAX_HISTORY_STEPS),
        present: next,
        future: [],
      }
    }
    case "update":
      return {
        ...state,
        present: cloneSnapshot(action.snapshot),
      }
    case "replace":
      return createHistoryState(action.snapshot)
    case "undo": {
      if (state.past.length === 0) return state

      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: cloneSnapshot(previous),
        future: [cloneSnapshot(state.present), ...state.future].slice(0, MAX_HISTORY_STEPS),
      }
    }
    case "redo": {
      if (state.future.length === 0) return state

      const next = state.future[0]
      return {
        past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY_STEPS),
        present: cloneSnapshot(next),
        future: state.future.slice(1),
      }
    }
    default:
      return state
  }
}

export const HISTORY_LIMIT = MAX_HISTORY_STEPS
