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
import { useRouter } from "next/navigation"
import Toolbar from "./Toolbar"
import ShortcutsOverlay from "./ShortcutsOverlay"
import DeployButton from "./DeployButton"
import SimulateButton from "./SimulateButton"
import TestsPanel from "./TestsPanel"
import BlockNode from "./BlockNode"
import TemplatesModal from "./TemplatesModal"
import { connectWallet, fetchWalletBalance, type StellarNetwork } from "@/lib/stellar/deploy"
import type { ContractGraph } from "@/lib/stellar/deploy"
import {
  buildShareUrl,
  SHARE_GRAPH_NODE_LIMIT,
  SHARE_GRAPH_PARAM,
  type DecodeSharedGraphResult,
} from "@/lib/share/graphShare"
import type { ContractTestRunResult } from "@/lib/stellar/test"
import type { Edge, Node } from "reactflow"

const nodeTypes = {
  Condition: BlockNode,
  Transfer: BlockNode,
  Storage: BlockNode,
  Event: BlockNode,
  Auth: BlockNode,
  default: BlockNode,
}

const initialNodes = [
  {
    id: "1",
    type: "default",
    position: { x: 250, y: 150 },
    data: { label: "Start" },
  },
]

interface Props {
  sharedGraphResult?: DecodeSharedGraphResult | null
}

export default function BlockEditor({ sharedGraphResult = null }: Props) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isSharedReadOnly, setIsSharedReadOnly] = useState(false)
  const [sharedGraphError, setSharedGraphError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<ContractTestRunResult | null>(null)
  const [overrideTestFailure, setOverrideTestFailure] = useState(false)
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
      if (isSharedReadOnly) return
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
    [isSharedReadOnly, reactFlowInstance, setNodes]
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

  useEffect(() => {
    if (!sharedGraphResult) {
      setIsSharedReadOnly(false)
      setSharedGraphError(null)
      return
    }

    if (sharedGraphResult.ok) {
      setNodes(sharedGraphResult.graph.nodes)
      setEdges(sharedGraphResult.graph.edges)
      setIsSharedReadOnly(true)
      setSharedGraphError(null)
      setTestResults(null)
      setOverrideTestFailure(false)
    } else {
      setIsSharedReadOnly(true)
      setSharedGraphError(sharedGraphResult.error)
    }
  }, [setEdges, setNodes, sharedGraphResult])

  const handleLoadTemplate = (graph: ContractGraph) => {
    if (isSharedReadOnly) return

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
      if (isSharedReadOnly) return
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
    [isSharedReadOnly, reactFlowInstance, setNodes]
  )

  const handleShare = useCallback(async () => {
    setShareError(null)

    try {
      const url = buildShareUrl(window.location.href, { nodes, edges })
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1500)
    } catch (error) {
      setShareCopied(false)
      setShareError(error instanceof Error ? error.message : "Unable to create share URL")
    }
  }, [edges, nodes])

  const handleForkSharedGraph = useCallback(() => {
    setIsSharedReadOnly(false)
    setTestResults(null)
    setOverrideTestFailure(false)
    const url = new URL(window.location.href)
    url.searchParams.delete(SHARE_GRAPH_PARAM)
    router.replace(url.pathname + url.search)
  }, [router])

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
    if (isSharedReadOnly) return
    void loadWalletInfo()
  }, [isSharedReadOnly, loadWalletInfo])

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
        onOpenTemplates={isSharedReadOnly ? undefined : () => setIsTemplatesOpen(true)}
        onAddBlock={onAddBlock}
        onShare={() => void handleShare()}
        isShareCopied={shareCopied}
        shareDisabled={nodes.length > SHARE_GRAPH_NODE_LIMIT}
      />

      {(shareCopied || shareError) && (
        <div
          role="status"
          className={`absolute left-4 top-60 z-20 max-w-[220px] rounded-lg border px-3 py-2 text-xs shadow ${
            shareError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {shareError ?? "Copied share URL!"}
        </div>
      )}

      {isSharedReadOnly && (
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 shadow-sm">
          <span className="font-medium">
            {sharedGraphError ? `Shared graph error: ${sharedGraphError}` : "Shared read-only graph"}
          </span>
          <button
            type="button"
            onClick={handleForkSharedGraph}
            className="rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Fork
          </button>
        </div>
      )}

      {!isSharedReadOnly && (
        <TestsPanel nodes={nodes} edges={edges} onResultsChange={handleTestResultsChange} />
      )}

      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          nodesDraggable={!isSharedReadOnly}
          nodesConnectable={!isSharedReadOnly}
          elementsSelectable={!isSharedReadOnly}
          edgesFocusable={!isSharedReadOnly}
          nodesFocusable={!isSharedReadOnly}
          zoomOnScroll
          zoomOnPinch
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {!isSharedReadOnly && (
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
      )}

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
