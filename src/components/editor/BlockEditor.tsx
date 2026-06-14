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
import { useCallback, useRef } from "react"
import Toolbar from "./Toolbar"
import DeployButton from "./DeployButton"

const BLOCK_COLORS: Record<string, string> = {
  Condition: "#bee3f8",
  Transfer: "#fefcbf",
  Storage: "#c6f6d5",
  Event: "#fed7d7",
  Auth: "#e9d8fd",
}

const initialNodes = [
  {
    id: "1",
    type: "default",
    position: { x: 250, y: 150 },
    data: { label: "Start" },
  },
]

let nodeIdCounter = 0

export default function BlockEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const blockType = event.dataTransfer.getData("application/blocktype")
      if (!blockType) return

      const instance = reactFlowInstance.current
      if (!instance) return

      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      nodeIdCounter += 1
      const newNode = {
        id: `${blockType.toLowerCase()}-${nodeIdCounter}`,
        type: "default" as const,
        position,
        data: { label: blockType },
        style: {
          background: BLOCK_COLORS[blockType] ?? "#e2e8f0",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "8px 16px",
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [setNodes]
  )

  return (
    <div className="relative h-full w-full">
      <Toolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <DeployButton nodes={nodes} edges={edges} />
    </div>
  )
}
