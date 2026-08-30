import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  GRAPH_AUTOSAVE_DEBOUNCE_MS,
  GRAPH_STORAGE_KEY,
  clearGraphStorage,
  loadGraphFromStorage,
  parseImportedGraphJson,
  saveGraphToStorage,
  toContractGraph,
  toReactFlowGraph,
} from "@/lib/editor/graphPersistence"
import { validateContractGraph } from "@/lib/compile/validate"
import tokenTransfer from "@/lib/templates/token-transfer.json"
import type { ContractGraph } from "@/lib/compile/schema"

const transferGraph = tokenTransfer as ContractGraph

describe("parseImportedGraphJson", () => {
  it("accepts a valid exported graph", () => {
    const result = parseImportedGraphJson(JSON.stringify(transferGraph))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes).toHaveLength(4)
      expect(result.graph.nodes[0].position).toEqual({ x: 250, y: 50 })
    }
  })

  it("rejects malformed JSON", () => {
    const result = parseImportedGraphJson("{not-json")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid json/i)
    }
  })

  it("rejects schema-invalid graphs without corrupting caller state", () => {
    const result = parseImportedGraphJson(
      JSON.stringify({
        nodes: [{ id: "1", type: "NotABlock", data: { label: "Bad" } }],
        edges: [],
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it("allows in-progress graphs with only a Start node", () => {
    const result = parseImportedGraphJson(
      JSON.stringify({
        nodes: [{ id: "1", type: "default", position: { x: 10, y: 20 }, data: { label: "Start" } }],
        edges: [],
      })
    )
    expect(result.ok).toBe(true)
  })
})

describe("toContractGraph / toReactFlowGraph round-trip", () => {
  it("preserves nodes, edges, and positions", () => {
    const { nodes, edges } = toReactFlowGraph(transferGraph)
    const exported = toContractGraph(nodes, edges)

    expect(exported.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }))).toEqual(
      transferGraph.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }))
    )
    expect(exported.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))).toEqual(
      transferGraph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    )
  })
})

describe("validateContractGraph position + skipStructureValidation", () => {
  it("preserves node positions", () => {
    const result = validateContractGraph(transferGraph)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.graph.nodes[0].position).toEqual({ x: 250, y: 50 })
    }
  })

  it("accepts Start-only graphs when structure validation is skipped", () => {
    const result = validateContractGraph(
      {
        nodes: [{ id: "1", type: "default", data: { label: "Start" } }],
        edges: [],
      },
      undefined,
      { skipStructureValidation: true }
    )
    expect(result.ok).toBe(true)
  })
})

/** Minimal in-memory localStorage stand-in used to exercise persistence under node. */
function createFakeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    store,
  }
}

let originalWindow: typeof globalThis.window | undefined
let fakeStorage: ReturnType<typeof createFakeStorage>

beforeEach(() => {
  originalWindow = (globalThis as { window?: unknown }).window as typeof globalThis.window | undefined
  fakeStorage = createFakeStorage()
  ;(globalThis as Record<string, unknown>).window = { localStorage: fakeStorage }
})

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window
  } else {
    ;(globalThis as Record<string, unknown>).window = originalWindow
  }
})

describe("localStorage persistence (issue #72 AC)", () => {
  it("saves the graph as serialised JSON under the fixed key", () => {
    saveGraphToStorage(transferGraph)
    const raw = fakeStorage.store.get(GRAPH_STORAGE_KEY)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw!)).toEqual(transferGraph)
  })

  it("round-trips a saved graph through loadGraphFromStorage", () => {
    saveGraphToStorage(transferGraph)
    const loaded = loadGraphFromStorage()
    expect(loaded).not.toBeNull()
    expect(loaded!.nodes.map((n) => n.id)).toEqual(transferGraph.nodes.map((n) => n.id))
  })

  it("uses a debounce delay matching the documented AC (~500ms)", () => {
    expect(GRAPH_AUTOSAVE_DEBOUNCE_MS).toBe(500)
  })

  it("returns null when no graph is stored", () => {
    expect(loadGraphFromStorage()).toBeNull()
  })

  it("returns null for invalid JSON (falls back to default Start node)", () => {
    fakeStorage.store.set(GRAPH_STORAGE_KEY, "{not-valid-json")
    expect(loadGraphFromStorage()).toBeNull()
  })

  it("returns null for a stored value that fails graph validation", () => {
    fakeStorage.store.set(GRAPH_STORAGE_KEY, JSON.stringify({ nodes: "nope", edges: [] }))
    expect(loadGraphFromStorage()).toBeNull()
  })

  it("clearGraphStorage removes the persisted entry", () => {
    saveGraphToStorage(transferGraph)
    expect(fakeStorage.store.has(GRAPH_STORAGE_KEY)).toBe(true)
    clearGraphStorage()
    expect(fakeStorage.store.has(GRAPH_STORAGE_KEY)).toBe(false)
    expect(loadGraphFromStorage()).toBeNull()
  })

  it("is a no-op when window is unavailable (SSR safety)", () => {
    delete (globalThis as Record<string, unknown>).window
    expect(() => saveGraphToStorage(transferGraph)).not.toThrow()
    expect(() => clearGraphStorage()).not.toThrow()
    expect(loadGraphFromStorage()).toBeNull()
  })
})
