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
import { useCallback } from "react"
import Toolbar from "./Toolbar"
import DeployButton from "./DeployButton"

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

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
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
