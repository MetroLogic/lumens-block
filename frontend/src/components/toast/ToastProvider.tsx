"use client"

import { createContext, useCallback, useContext, useMemo, useReducer } from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { createToastId, toastReducer, type ToastMessage, type ToastVariant } from "./toastStore"

interface ToastOptions {
  title: string
  description?: string
}

interface ToastContextValue {
  success: (options: ToastOptions) => string
  error: (options: ToastOptions) => string
  info: (options: ToastOptions) => string
  dismiss: (id: string) => void
  clear: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; className: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    iconClassName: "text-emerald-600",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-950",
    iconClassName: "text-red-600",
  },
  info: {
    icon: Info,
    className: "border-sky-200 bg-sky-50 text-sky-950",
    iconClassName: "text-sky-600",
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const addToast = useCallback((variant: ToastVariant, options: ToastOptions) => {
    const now = Date.now()
    const toast: ToastMessage = {
      id: createToastId(now, Math.random()),
      title: options.title,
      description: options.description,
      variant,
      createdAt: now,
    }
    dispatch({ type: "add", toast })
    window.setTimeout(() => dispatch({ type: "dismiss", id: toast.id }), 5000)
    return toast.id
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (options) => addToast("success", options),
      error: (options) => addToast("error", options),
      info: (options) => addToast("info", options),
      dismiss: (id) => dispatch({ type: "dismiss", id }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-24 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((toast) => {
          const style = variantStyles[toast.variant]
          const Icon = style.icon
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-sm shadow-lg ${style.className}`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${style.iconClassName}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-5">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 break-words text-xs leading-5 opacity-80">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "dismiss", id: toast.id })}
                className="rounded p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
                aria-label={`Dismiss ${toast.title}`}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
