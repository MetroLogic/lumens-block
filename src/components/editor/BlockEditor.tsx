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
import { applyAutoLayout } from "@/lib/layout"
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

  return (
    <div className="relative h-full w-full">
      <Toolbar onAutoLayout={handleAutoLayout} />
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
