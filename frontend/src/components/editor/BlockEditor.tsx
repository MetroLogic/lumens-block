"use client"

import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
} from "reactflow"
import "reactflow/dist/style.css"
import { useCallback, useState } from "react"
import Toolbar from "./Toolbar"
import DeployButton from "./DeployButton"
import TemplatesModal from "./TemplatesModal"
import type { ContractGraph } from "@/lib/stellar/deploy"

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
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
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

    setNodes(graph.nodes)
    setEdges(graph.edges)
    setIsTemplatesOpen(false)
  }

  return (
    <div className="relative h-full w-full">
      <Toolbar onOpenTemplates={() => setIsTemplatesOpen(true)} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <DeployButton nodes={nodes} edges={edges} />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleLoadTemplate}
      />
    </div>
  )
}

