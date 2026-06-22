"use client"

import type { NodeProps } from "reactflow"
import BaseBlockNode, { type BlockNodeData } from "./BaseBlockNode"

export default function TransferNode(props: NodeProps<BlockNodeData>) {
  return <BaseBlockNode {...props} blockType="Transfer" />
}
