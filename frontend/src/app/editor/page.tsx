import { Suspense } from "react"

import EditorPageClient from "./EditorPageClient"

export default function EditorPage() {
  return (
    <div className="h-screen w-screen">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading editor...</div>}>
        <EditorPageClient />
      </Suspense>
    </div>
  )
}
