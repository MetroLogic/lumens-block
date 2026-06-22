import type { Edge, Node } from "reactflow"

export interface BulkDeleteResult {
  nodes: Node[]
  edges: Edge[]
  deletedNodeIds: string[]
  deletedEdgeIds: string[]
}

export function getSelectedNodeIds(nodes: Node[]): string[] {
  return nodes.filter((node) => node.selected).map((node) => node.id)
}

export function deleteSelectedNodes(nodes: Node[], edges: Edge[]): BulkDeleteResult {
  const deletedNodeIds = getSelectedNodeIds(nodes)
  if (deletedNodeIds.length === 0) {
    return { nodes, edges, deletedNodeIds: [], deletedEdgeIds: [] }
  }

  const deletedNodeIdSet = new Set(deletedNodeIds)
  const nextNodes = nodes.filter((node) => !deletedNodeIdSet.has(node.id))
  const deletedEdgeIds: string[] = []
  const nextEdges = edges.filter((edge) => {
    const connectedToDeletedNode =
      deletedNodeIdSet.has(edge.source) || deletedNodeIdSet.has(edge.target)

    if (connectedToDeletedNode) {
      deletedEdgeIds.push(edge.id)
    }

    return !connectedToDeletedNode
  })

  return {
    nodes: nextNodes,
    edges: nextEdges,
    deletedNodeIds,
    deletedEdgeIds,
  }
}
