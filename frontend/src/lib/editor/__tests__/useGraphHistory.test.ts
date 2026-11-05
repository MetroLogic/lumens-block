import { describe, expect, it } from "vitest"
import { GraphHistory, type GraphSnapshot } from "@/lib/editor/useGraphHistory"

const snap = (id: string, edgeId?: string): GraphSnapshot => ({
  nodes: [{ id, position: { x: 0, y: 0 }, data: { label: id } }] as any,
  edges: edgeId ? [{ id: edgeId, source: id, target: "target" }] as any : [],
})

describe("useGraphHistory / GraphHistory", () => {
  // -----------------------------------------------------------------------
  // Basic push / undo / redo cycle
  // -----------------------------------------------------------------------
  describe("push-undo-redo cycle", () => {
    it("starts with no undo / redo available", () => {
      const h = new GraphHistory(snap("A"))
      expect(h.canUndo).toBe(false)
      expect(h.canRedo).toBe(false)
      expect(h.snapshot.nodes[0].id).toBe("A")
    })

    it("push enables undo but not redo", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      expect(h.canUndo).toBe(true)
      expect(h.canRedo).toBe(false)
      expect(h.snapshot.nodes[0].id).toBe("B")
    })

    it("undo restores the previous snapshot and enables redo", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      const undone = h.undo()
      expect(undone?.nodes[0].id).toBe("A")
      expect(h.snapshot.nodes[0].id).toBe("A")
      expect(h.canRedo).toBe(true)
      expect(h.canUndo).toBe(false)
    })

    it("redo restores the undone snapshot and enables undo", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      h.undo()
      const redone = h.redo()
      expect(redone?.nodes[0].id).toBe("B")
      expect(h.snapshot.nodes[0].id).toBe("B")
      expect(h.canUndo).toBe(true)
      expect(h.canRedo).toBe(false)
    })

    it("supports multi-step undo and redo", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      h.push(snap("C"))
      h.push(snap("D"))

      expect(h.undo()?.nodes[0].id).toBe("C")
      expect(h.snapshot.nodes[0].id).toBe("C")

      expect(h.undo()?.nodes[0].id).toBe("B")
      expect(h.snapshot.nodes[0].id).toBe("B")

      expect(h.undo()?.nodes[0].id).toBe("A")
      expect(h.snapshot.nodes[0].id).toBe("A")
      expect(h.canUndo).toBe(false)

      expect(h.redo()?.nodes[0].id).toBe("B")
      expect(h.snapshot.nodes[0].id).toBe("B")

      expect(h.redo()?.nodes[0].id).toBe("C")
      expect(h.snapshot.nodes[0].id).toBe("C")

      expect(h.redo()?.nodes[0].id).toBe("D")
      expect(h.snapshot.nodes[0].id).toBe("D")
      expect(h.canRedo).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Redo clear-on-push
  // -----------------------------------------------------------------------
  describe("redo clear-on-push", () => {
    it("clears the redo stack when a new action is pushed after undo", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      h.push(snap("C"))

      // Undo back to B
      h.undo()
      expect(h.snapshot.nodes[0].id).toBe("B")
      expect(h.canRedo).toBe(true)

      // Push divergent action D
      h.push(snap("D"))
      expect(h.canRedo).toBe(false)
      expect(h.futureLength).toBe(0)
      expect(h.snapshot.nodes[0].id).toBe("D")

      // Next undo should go to B, not C
      h.undo()
      expect(h.snapshot.nodes[0].id).toBe("B")
    })
  })

  // -----------------------------------------------------------------------
  // Cap enforcement
  // -----------------------------------------------------------------------
  describe("cap enforcement", () => {
    it("caps history at maxDepth and evicts the oldest entry", () => {
      const h = new GraphHistory(snap("init"), 3)

      h.push(snap("1"))
      h.push(snap("2"))
      h.push(snap("3"))

      // Past should have reached cap: 3 entries [init, 1, 2]
      expect(h.pastLength).toBe(3)

      // Another push evicts the oldest entry ("init")
      h.push(snap("4"))
      expect(h.pastLength).toBe(3)

      // Undo 3 times: should reach "1" ("init" was evicted)
      h.undo() // -> 3
      h.undo() // -> 2
      h.undo() // -> 1
      expect(h.snapshot.nodes[0].id).toBe("1")
      expect(h.canUndo).toBe(false) // cannot undo further
    })

    it("defaults to maxDepth of 100", () => {
      const h = new GraphHistory(snap("0"))
      for (let i = 1; i <= 150; i++) {
        h.push(snap(String(i)))
      }
      expect(h.pastLength).toBe(100)
    })
  })

  // -----------------------------------------------------------------------
  // Deep-clone isolation
  // -----------------------------------------------------------------------
  describe("deep-clone isolation", () => {
    it("mutating live node/edge state does not corrupt history snapshots", () => {
      const original = snap("mutable", "edge-1")
      const h = new GraphHistory(original)
      h.push(snap("next", "edge-2"))

      // Mutate the original external object
      original.nodes[0].id = "CORRUPTED"
      original.edges[0].id = "EDGE_CORRUPTED"

      // Undoing must retrieve the untouched, original snapshot
      const restored = h.undo()
      expect(restored?.nodes[0].id).toBe("mutable")
      expect(restored?.edges[0].id).toBe("edge-1")
      expect(h.snapshot.nodes[0].id).toBe("mutable")
      expect(h.snapshot.edges[0].id).toBe("edge-1")
    })

    it("mutating returned snapshot does not corrupt internal past stack", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      const undone = h.undo()

      // Mutate returned object
      if (undone) undone.nodes[0].id = "CORRUPTED"

      // Redo then undo again should still yield the uncorrupted state
      h.redo()
      expect(h.snapshot.nodes[0].id).toBe("B")
    })
  })

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------
  describe("clear", () => {
    it("empties past and future stacks without changing current snapshot", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      h.push(snap("C"))
      h.undo()

      expect(h.canUndo).toBe(true)
      expect(h.canRedo).toBe(true)

      h.clear()
      expect(h.canUndo).toBe(false)
      expect(h.canRedo).toBe(false)
      expect(h.snapshot.nodes[0].id).toBe("B")
    })

    it("supports resetting current snapshot when clearing", () => {
      const h = new GraphHistory(snap("A"))
      h.push(snap("B"))
      h.clear(snap("NEW_ROOT"))

      expect(h.canUndo).toBe(false)
      expect(h.canRedo).toBe(false)
      expect(h.snapshot.nodes[0].id).toBe("NEW_ROOT")
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("undo on empty history returns undefined and leaves snapshot intact", () => {
      const h = new GraphHistory(snap("A"))
      expect(h.undo()).toBeUndefined()
      expect(h.snapshot.nodes[0].id).toBe("A")
    })

    it("redo on empty future returns undefined and leaves snapshot intact", () => {
      const h = new GraphHistory(snap("A"))
      expect(h.redo()).toBeUndefined()
      expect(h.snapshot.nodes[0].id).toBe("A")
    })
  })
})
