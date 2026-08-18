"use client"

import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type ReactFlowInstance,
} from "reactflow"
import "reactflow/dist/style.css"
import { useCallback, useEffect, useState } from "react"
import { applyAutoLayout } from "@/lib/layout"
import {
  EMPTY_GRAPH_NODES,
  GRAPH_AUTOSAVE_DEBOUNCE_MS,
  clearGraphStorage,
  downloadGraphJson,
  loadGraphFromStorage,
  parseImportedGraphJson,
  saveGraphToStorage,
  toContractGraph,
  toReactFlowGraph,
} from "@/lib/editor/graphPersistence"
import Toolbar from "./Toolbar"
import ShortcutsOverlay from "./ShortcutsOverlay"
import DeployButton from "./DeployButton"
import SimulateButton from "./SimulateButton"
import TestsPanel from "./TestsPanel"
import InvokePanel from "./InvokePanel"
import BlockNode from "./BlockNode"
import TemplatesModal from "./TemplatesModal"
import CodePreviewModal from "./CodePreviewModal"
import { useTheme } from "./ThemeContext"
import { connectWallet, fetchWalletBalance, type StellarNetwork } from "@/lib/stellar/deploy"
import type { ContractGraph } from "@/lib/stellar/deploy"
import type { ContractTestRunResult } from "@/lib/stellar/test"

const nodeTypes = {
  Condition: BlockNode,
  Transfer: BlockNode,
  Storage: BlockNode,
  Event: BlockNode,
  Auth: BlockNode,
  FunctionEntry: BlockNode,
  FunctionReturn: BlockNode,
  default: BlockNode,
}

export default function BlockEditor() {
  const { theme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState(EMPTY_GRAPH_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [hydrated, setHydrated] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isCodePreviewOpen, setIsCodePreviewOpen] = useState(false)
  const [testResults, setTestResults] = useState<ContractTestRunResult | null>(null)
  const [overrideTestFailure, setOverrideTestFailure] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<StellarNetwork>("testnet")
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string>("—")
  const [walletError, setWalletError] = useState<string | null>(null)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  const [deployedContractId, setDeployedContractId] = useState<string | null>(null)

  const showToast = useCallback((message: string, type: "error" | "success" = "error") => {
    setToast({ message, type })
  }, [])

  const applyGraph = useCallback(
    (graph: ContractGraph) => {
      const { nodes: nextNodes, edges: nextEdges } = toReactFlowGraph(graph)
      setNodes(nextNodes)
      setEdges(nextEdges)
      setTestResults(null)
      setOverrideTestFailure(false)
    },
    [setNodes, setEdges]
  )

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (!reactFlowInstance) return

      const type = event.dataTransfer.getData("application/blocktype")
      if (typeof type === "undefined" || !type) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        position,
        data: { label: type },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const loadWalletInfo = useCallback(async () => {
    setIsWalletLoading(true)
    setWalletError(null)

    try {
      const address = await connectWallet()
      const balance = await fetchWalletBalance(address, selectedNetwork)
      setWalletAddress(address)
      setWalletBalance(balance)
    } catch (error) {
      setWalletAddress(null)
      setWalletBalance("—")
      setWalletError(error instanceof Error ? error.message : "Unable to load wallet info")
    } finally {
      setIsWalletLoading(false)
    }
  }, [selectedNetwork])

  const handleLoadTemplate = (graph: ContractGraph) => {
    const isNonEmpty =
      nodes.length > 1 ||
      edges.length > 0 ||
      (nodes.length === 1 && nodes[0].data?.label !== "Start")

    if (isNonEmpty) {
      const confirmLoad = window.confirm(
        "Loading a template will overwrite your current canvas. Are you sure you want to proceed?"
      )
      if (!confirmLoad) return
    }

    applyGraph(graph)
    setIsTemplatesOpen(false)
  }

  const handleNew = useCallback(() => {
    const confirmed = window.confirm(
      "Clear the canvas and start a new graph? Unsaved changes in the current session will be lost."
    )
    if (!confirmed) return

    setNodes(EMPTY_GRAPH_NODES)
    setEdges([])
    setTestResults(null)
    setOverrideTestFailure(false)
    clearGraphStorage()
    saveGraphToStorage(toContractGraph(EMPTY_GRAPH_NODES, []))
  }, [setNodes, setEdges])

  const handleExport = useCallback(() => {
    downloadGraphJson(toContractGraph(nodes, edges))
  }, [nodes, edges])

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const result = parseImportedGraphJson(text)
        if (!result.ok) {
          showToast(result.error, "error")
          return
        }
        applyGraph(result.graph)
        showToast("Graph imported successfully.", "success")
      } catch {
        showToast("Could not read the selected file.", "error")
      }
    },
    [applyGraph, showToast]
  )

  const onAddBlock = useCallback(
    (type: string) => {
      if (!reactFlowInstance) return

      const offset = nodes.length * 180
      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2 + offset,
      })

      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        position,
        data: { label: type },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [nodes.length, reactFlowInstance, setNodes]
  )

  const handleTestResultsChange = useCallback((result: ContractTestRunResult | null) => {
    setTestResults(result)
    if (result?.allPassed) {
      setOverrideTestFailure(false)
    }
  }, [])

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) =>
      applyAutoLayout(nds, edges).map((node) => ({
        ...node,
        style: { ...node.style, transition: "all 0.3s ease" },
      }))
    )
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          const { transition, ...restStyle } = node.style || {}
          return {
            ...node,
            style: Object.keys(restStyle).length ? restStyle : undefined,
          }
        })
      )
    }, 300)
  }, [edges, setNodes])

  const testsBlockingDeploy = testResults !== null && !testResults.allPassed && !overrideTestFailure

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !shortcutsOpen) setShortcutsOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shortcutsOpen])

  useEffect(() => {
    void loadWalletInfo()
  }, [loadWalletInfo])

  // Restore graph from localStorage once on mount
  useEffect(() => {
    const saved = loadGraphFromStorage()
    if (saved) {
      const { nodes: restoredNodes, edges: restoredEdges } = toReactFlowGraph(saved)
      setNodes(restoredNodes)
      setEdges(restoredEdges)
    }
    setHydrated(true)
  }, [setNodes, setEdges])

  // Debounced auto-save
  useEffect(() => {
    if (!hydrated) return

    const timer = window.setTimeout(() => {
      saveGraphToStorage(toContractGraph(nodes, edges))
    }, GRAPH_AUTOSAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [nodes, edges, hydrated])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
        <select
          value={selectedNetwork}
          onChange={(event) => setSelectedNetwork(event.target.value as StellarNetwork)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
        <button
          onClick={() => void loadWalletInfo()}
          disabled={isWalletLoading}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {isWalletLoading ? "Checking..." : walletAddress ? "Refresh" : "Connect"}
        </button>
        {walletAddress && (
          <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {walletBalance} XLM
          </span>
        )}
      </div>

      <Toolbar
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onAddBlock={onAddBlock}
        onAutoLayout={handleAutoLayout}
        onNew={handleNew}
        onExport={handleExport}
        onImport={(file) => void handleImport(file)}
      />

      <TestsPanel nodes={nodes} edges={edges} onResultsChange={handleTestResultsChange} />

      <InvokePanel deployedContractId={deployedContractId} network={selectedNetwork} />

      <div className="h-full w-full" data-testid="editor-canvas" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color={theme === "dark" ? "#475569" : "#94a3b8"} />
          <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-slate-200" />
          <MiniMap className="dark:bg-slate-800 dark:border-slate-700" maskColor={theme === "dark" ? "rgba(15, 23, 42, 0.7)" : "rgba(240, 242, 245, 0.7)"} />
        </ReactFlow>
      </div>

      <div className="absolute bottom-6 right-6 z-10 flex max-w-sm flex-col items-end gap-2">
        {testsBlockingDeploy && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">
            <p className="font-semibold">Tests failed — deployment blocked</p>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={overrideTestFailure}
                onChange={(e) => setOverrideTestFailure(e.target.checked)}
              />
              Override and deploy anyway
            </label>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCodePreviewOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Preview generated Soroban contract code"
          >
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">&lt;/&gt;</span> Code Preview
          </button>
          <SimulateButton nodes={nodes} edges={edges} />
          <DeployButton
            nodes={nodes}
            edges={edges}
            selectedNetwork={selectedNetwork}
            walletAddress={walletAddress}
            walletBalance={walletBalance}
            disabled={testsBlockingDeploy}
            onDeploySuccess={(id) => setDeployedContractId(id)}
          />
        </div>
      </div>

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleLoadTemplate}
      />
      <CodePreviewModal
        isOpen={isCodePreviewOpen}
        onClose={() => setIsCodePreviewOpen(false)}
        nodes={nodes}
        edges={edges}
      />

      {toast && (
        <div
          role="status"
          className={`absolute left-1/2 top-4 z-30 max-w-md -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/80 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {walletError && (
        <div className="absolute bottom-20 right-6 z-20 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow">
          {walletError}
        </div>
      )}
    </div>
  )
}
