"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"

import BlockEditor from "@/components/editor/BlockEditor"
import { decodeSharedGraph, SHARE_GRAPH_PARAM } from "@/lib/share/graphShare"

export default function EditorPageClient() {
  const searchParams = useSearchParams()
  const sharedGraphParam = searchParams.get(SHARE_GRAPH_PARAM)

  const sharedGraphResult = useMemo(
    () => (sharedGraphParam ? decodeSharedGraph(sharedGraphParam) : null),
    [sharedGraphParam]
  )

  return <BlockEditor sharedGraphResult={sharedGraphResult} />
}
