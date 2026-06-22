"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"

export default function ShareInspectButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    const shareUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={() => void copyUrl()}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      <Link2 className="h-4 w-4" />
      {copied ? "Copied" : "Share"}
    </button>
  )
}
