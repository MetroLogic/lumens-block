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
import { validateGraph } from "@/lib/validation/validateGraph"
import { connectWallet, fetchWalletBalance, type StellarNetwork } from "@/lib/stellar/deploy"
import type { ContractGraph } from "@/lib/stellar/deploy"
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

export default function BlockEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
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

  const graphValidation = validateGraph({ nodes, edges })
  const validationIssuesByNode = graphValidation.issues.reduce<Record<string, string[]>>((acc, issue) => {
    if (!issue.nodeId) return acc
    acc[issue.nodeId] = [...(acc[issue.nodeId] ?? []), issue.message]
    return acc
  }, {})
  const validatedNodes = nodes.map((node) => {
    const messages = validationIssuesByNode[node.id] ?? []

    return {
      ...node,
      data: {
        ...(node.data ?? {}),
        validationError: messages.length > 0,
        validationMessages: messages,
      },
    }
  })
  const testsBlockingDeploy = testResults !== null && !testResults.allPassed && !overrideTestFailure
  const validationBlockingDeploy = !graphValidation.valid
  const deployDisabledReason = validationBlockingDeploy
    ? "Resolve graph validation errors before deploying"
    : testsBlockingDeploy
      ? "Fix failing tests or enable override to deploy"
      : undefined

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

      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={validatedNodes}
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
        {validationBlockingDeploy && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 shadow">
            <p className="font-semibold">Graph validation failed</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {graphValidation.issues.slice(0, 5).map((issue) => (
                <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
            {graphValidation.issues.length > 5 && (
              <p className="mt-1 text-red-700">+{graphValidation.issues.length - 5} more issues</p>
            )}
          </div>
        )}
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
            disabled={testsBlockingDeploy || validationBlockingDeploy}
            disabledReason={deployDisabledReason}
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
