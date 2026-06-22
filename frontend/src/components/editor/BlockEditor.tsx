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
import { useCallback, useEffect, useRef, useState } from "react"
import Toolbar from "./Toolbar"
import ShortcutsOverlay from "./ShortcutsOverlay"
import DeployButton from "./DeployButton"
import SimulateButton from "./SimulateButton"
import TestsPanel from "./TestsPanel"
import BlockNode from "./BlockNode"
import TemplatesModal from "./TemplatesModal"
import { connectWallet, fetchWalletBalance, type StellarNetwork } from "@/lib/stellar/deploy"
import type { ContractGraph } from "@/lib/stellar/deploy"
import type { ContractTestRunResult } from "@/lib/stellar/test"
import {
  GRAPH_EXPORT_FILE_NAME,
  GRAPH_STORAGE_KEY,
  graphToJson,
  graphToReactFlow,
  readStoredGraph,
  validateGraphJsonText,
  writeStoredGraph,
} from "@/lib/editor/graphStorage"
import type { Edge, Node } from "reactflow"

const nodeTypes = {
  Condition: BlockNode,
  Transfer: BlockNode,
  Storage: BlockNode,
  Event: BlockNode,
  Auth: BlockNode,
  default: BlockNode,
}

const initialNodes: Node[] = [
  {
    id: "1",
    type: "default",
    position: { x: 250, y: 150 },
    data: { label: "Start" },
  },
]

function createInitialNodes() {
  return initialNodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  }))
}

type GraphMessage = {
  type: "success" | "error" | "info"
  text: string
}

export default function BlockEditor() {
  const [initialStoredGraph] = useState(() => {
    if (typeof window === "undefined") return null
    return readStoredGraph(window.localStorage)
  })
  const initialFlowGraph = initialStoredGraph?.ok ? graphToReactFlow(initialStoredGraph.graph) : null
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowGraph?.nodes ?? createInitialNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowGraph?.edges ?? [])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [graphMessage, setGraphMessage] = useState<GraphMessage | null>(() => {
    if (initialStoredGraph && !initialStoredGraph.ok) {
      return { type: "error", text: `Saved graph could not be restored: ${initialStoredGraph.error.message}` }
    }
    return null
  })
  const [testResults, setTestResults] = useState<ContractTestRunResult | null>(null)
  const [overrideTestFailure, setOverrideTestFailure] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<StellarNetwork>("testnet")
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string>("—")
  const [walletError, setWalletError] = useState<string | null>(null)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

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

  const loadGraph = useCallback(
    (graph: ContractGraph, message?: GraphMessage) => {
      const flowGraph = graphToReactFlow(graph)
      setNodes(flowGraph.nodes)
      setEdges(flowGraph.edges)
      setTestResults(null)
      setOverrideTestFailure(false)
      if (message) setGraphMessage(message)
    },
    [setEdges, setNodes]
  )

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

    loadGraph(graph, { type: "success", text: "Template loaded." })
    setIsTemplatesOpen(false)
  }

  const handleNewGraph = useCallback(() => {
    const confirmNew = window.confirm("Start a new graph? This will clear the current canvas.")
    if (!confirmNew) return

    setNodes(createInitialNodes())
    setEdges([])
    setTestResults(null)
    setOverrideTestFailure(false)
    window.localStorage.removeItem(GRAPH_STORAGE_KEY)
    setGraphMessage({ type: "info", text: "New graph created." })
  }, [setEdges, setNodes])

  const handleExportGraph = useCallback(() => {
    const blob = new Blob([graphToJson(nodes, edges)], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = GRAPH_EXPORT_FILE_NAME
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setGraphMessage({ type: "success", text: "Graph exported." })
  }, [edges, nodes])

  const handleImportGraph = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return

      const text = await file.text()
      const validation = validateGraphJsonText(text)
      if (!validation.ok) {
        setGraphMessage({ type: "error", text: validation.error.message })
        return
      }

      loadGraph(validation.graph, { type: "success", text: "Graph imported." })
    },
    [loadGraph]
  )

  const onAddBlock = useCallback(
    (type: string) => {
      if (!reactFlowInstance) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
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

  const handleTestResultsChange = useCallback((result: ContractTestRunResult | null) => {
    setTestResults(result)
    if (result?.allPassed) {
      setOverrideTestFailure(false)
    }
  }, [])

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

  useEffect(() => {
    if (typeof window === "undefined") return

    const timer = window.setTimeout(() => {
      try {
        writeStoredGraph(window.localStorage, nodes, edges)
      } catch {
        setGraphMessage({ type: "error", text: "Graph could not be saved in this browser." })
      }
    }, 500)

    return () => window.clearTimeout(timer)
  }, [edges, nodes])

  return (
    <div className="relative h-full w-full bg-slate-50">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
        <select
          value={selectedNetwork}
          onChange={(event) => setSelectedNetwork(event.target.value as StellarNetwork)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
        <button
          onClick={() => void loadWalletInfo()}
          disabled={isWalletLoading}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {isWalletLoading ? "Checking..." : walletAddress ? "Refresh" : "Connect"}
        </button>
        {walletAddress && (
          <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {walletBalance} XLM
          </span>
        )}
      </div>

      <Toolbar
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onAddBlock={onAddBlock}
        onNewGraph={handleNewGraph}
        onExportGraph={handleExportGraph}
        onImportGraph={handleImportGraph}
      />

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => void handleImportFile(event)}
        className="hidden"
      />

      <TestsPanel nodes={nodes} edges={edges} onResultsChange={handleTestResultsChange} />

      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
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
          <Background />
          <Controls />
          <MiniMap />
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
          <SimulateButton nodes={nodes} edges={edges} />
          <DeployButton
            nodes={nodes}
            edges={edges}
            selectedNetwork={selectedNetwork}
            walletAddress={walletAddress}
            walletBalance={walletBalance}
            disabled={testsBlockingDeploy}
          />
        </div>
      </div>

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleLoadTemplate}
      />

      {walletError && (
        <div className="absolute bottom-20 right-6 z-20 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow">
          {walletError}
        </div>
      )}

      {graphMessage && (
        <div
          role={graphMessage.type === "error" ? "alert" : "status"}
          className={`absolute bottom-20 left-4 z-20 max-w-sm rounded-lg border px-3 py-2 text-sm shadow ${
            graphMessage.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : graphMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          {graphMessage.text}
        </div>
      )}
    </div>
  )
}
