"use client"

import React from "react"
import { CheckCircle2, Info, XCircle } from "lucide-react"
import { useToast } from "./ToastProvider"

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const

const STYLES: Record<string, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/80 dark:text-red-200",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/80 dark:text-sky-200",
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${STYLES[t.type]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
            >
              <span aria-hidden="true" className="text-base leading-none">
                ×
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}