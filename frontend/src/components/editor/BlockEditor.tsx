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
import type { Edge, Node } from "reactflow"

const GRAPH_STORAGE_KEY = "lumens-block:editor-graph"

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

function readStoredGraph(): { nodes: Node[]; edges: Edge[] } | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { nodes?: Node[]; edges?: Edge[] }

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || parsed.nodes.length === 0) {
      return null
    }

    return { nodes: parsed.nodes, edges: parsed.edges }
  } catch {
    return null
  }
}

function serializeGraph(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: typeof node.data?.label === "string" ? node.data.label : node.type ?? "Block",
        ...(node.data?.params ? { params: node.data.params } : {}),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  }
}

export default function BlockEditor() {
  const [initialGraph] = useState(() => readStoredGraph())
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph?.nodes ?? initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges ?? [])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [testResults, setTestResults] = useState<ContractTestRunResult | null>(null)
  const [overrideTestFailure, setOverrideTestFailure] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState<StellarNetwork>("testnet")
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string>("—")
  const [walletError, setWalletError] = useState<string | null>(null)
  const [isWalletLoading, setIsWalletLoading] = useState(false)

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

    setNodes(graph.nodes as Node[])
    setEdges(graph.edges as Edge[])
    setIsTemplatesOpen(false)
    setTestResults(null)
    setOverrideTestFailure(false)
  }

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
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null

  const handleNodeLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label,
                },
              }
            : node
        )
      )
      setTestResults(null)
      setOverrideTestFailure(false)
    },
    [setNodes]
  )

  const handleNodeParamChange = useCallback(
    (nodeId: string, paramName: string, value: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  params: {
                    ...(node.data?.params ?? {}),
                    [paramName]: value,
                  },
                },
              }
            : node
        )
      )
      setTestResults(null)
      setOverrideTestFailure(false)
    },
    [setNodes]
  )

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
    window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(serializeGraph(nodes, edges)))
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
      />

      <TestsPanel nodes={nodes} edges={edges} onResultsChange={handleTestResultsChange} />

      <div
        className="h-full w-full"
        data-testid="editor-canvas"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onLabelChange={handleNodeLabelChange}
          onParamChange={handleNodeParamChange}
        />
      )}

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
    </div>
  )
}

function NodeConfigPanel({
  node,
  onClose,
  onLabelChange,
  onParamChange,
}: {
  node: Node
  onClose: () => void
  onLabelChange: (nodeId: string, label: string) => void
  onParamChange: (nodeId: string, paramName: string, value: string) => void
}) {
  const label = typeof node.data?.label === "string" ? node.data.label : node.type ?? "Block"
  const params = (node.data?.params ?? {}) as Record<string, string>
  const paramConfig = getParamConfig(node.type)

  return (
    <aside
      data-testid="node-config-panel"
      className="absolute bottom-4 left-4 z-30 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configure Block</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{node.type === "default" ? "Start" : node.type}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Label
        <input
          aria-label="Node label"
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={label}
          onChange={(event) => onLabelChange(node.id, event.target.value)}
        />
      </label>

      {paramConfig && (
        <label className="mt-3 block text-sm font-medium text-slate-700">
          {paramConfig.label}
          <input
            aria-label={paramConfig.label}
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={params[paramConfig.name] ?? ""}
            onChange={(event) => onParamChange(node.id, paramConfig.name, event.target.value)}
            placeholder={paramConfig.placeholder}
          />
        </label>
      )}
    </aside>
  )
}

function getParamConfig(type?: string): { name: string; label: string; placeholder: string } | null {
  switch (type) {
    case "Transfer":
      return { name: "token", label: "Token contract", placeholder: "CDLZFC3SY..." }
    case "Storage":
      return { name: "storageKey", label: "Storage key", placeholder: "balance" }
    case "Event":
      return { name: "eventName", label: "Event name", placeholder: "transfer" }
    case "Condition":
      return { name: "condition", label: "Condition", placeholder: "amount > 0" }
    default:
      return null
  }
}
