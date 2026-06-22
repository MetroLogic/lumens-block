"use client"

import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow"
import "reactflow/dist/style.css"

import InspectorNode from "./InspectorNode"

const nodeTypes = {
  inspector: InspectorNode,
}

interface InspectorCanvasProps {
  nodes: Node[]
  edges: Edge[]
}

export default function InspectorCanvas({ nodes, edges }: InspectorCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      nodesFocusable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable={false} zoomable={false} />
    </ReactFlow>
  )
}
