import { describe, expect, it } from "vitest"
import type { Node } from "reactflow"

import { HISTORY_LIMIT, createHistoryState, historyReducer } from "./historyReducer"

const start: Node = {
  id: "1",
  type: "default",
  position: { x: 0, y: 0 },
  data: { label: "Start" },
}

function snapshot(label: string) {
  return {
    nodes: [{ ...start, data: { label } }],
    edges: [],
  }
}

describe("historyReducer", () => {
  it("undoes and redoes committed graph snapshots", () => {
    let state = createHistoryState(snapshot("Start"))
    state = historyReducer(state, { type: "commit", snapshot: snapshot("A") })
    state = historyReducer(state, { type: "commit", snapshot: snapshot("B") })

    expect(state.present.nodes[0].data.label).toBe("B")
    expect(state.past).toHaveLength(2)

    state = historyReducer(state, { type: "undo" })
    expect(state.present.nodes[0].data.label).toBe("A")
    expect(state.future).toHaveLength(1)

    state = historyReducer(state, { type: "redo" })
    expect(state.present.nodes[0].data.label).toBe("B")
    expect(state.future).toHaveLength(0)
  })

  it("clears redo history on a new commit", () => {
    let state = createHistoryState(snapshot("Start"))
    state = historyReducer(state, { type: "commit", snapshot: snapshot("A") })
    state = historyReducer(state, { type: "undo" })
    state = historyReducer(state, { type: "commit", snapshot: snapshot("C") })

    expect(state.present.nodes[0].data.label).toBe("C")
    expect(state.future).toHaveLength(0)
  })

  it("updates the visible graph without adding undo history", () => {
    let state = createHistoryState(snapshot("Start"))
    state = historyReducer(state, { type: "update", snapshot: snapshot("Dragging") })

    expect(state.present.nodes[0].data.label).toBe("Dragging")
    expect(state.past).toHaveLength(0)
  })

  it("commits a drag from the original snapshot after live updates", () => {
    let state = createHistoryState(snapshot("Start"))
    const base = state.present

    state = historyReducer(state, { type: "update", snapshot: snapshot("Dragging") })
    state = historyReducer(state, {
      type: "commitFrom",
      base,
      snapshot: snapshot("Dropped"),
    })

    expect(state.present.nodes[0].data.label).toBe("Dropped")
    expect(state.past[0].nodes[0].data.label).toBe("Start")
  })

  it("clears history when replacing the current graph", () => {
    let state = createHistoryState(snapshot("Start"))
    state = historyReducer(state, { type: "commit", snapshot: snapshot("A") })
    state = historyReducer(state, { type: "replace", snapshot: snapshot("Template") })

    expect(state.present.nodes[0].data.label).toBe("Template")
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
  })

  it("caps undo history at 50 steps", () => {
    let state = createHistoryState(snapshot("Start"))

    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      state = historyReducer(state, { type: "commit", snapshot: snapshot(`Step ${i}`) })
    }

    expect(state.past).toHaveLength(HISTORY_LIMIT)
    expect(state.past[0].nodes[0].data.label).toBe("Step 4")
  })
})
