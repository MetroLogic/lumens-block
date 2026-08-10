"use client"

import React, { createContext, useCallback, useContext, useState } from "react"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toasts: Toast[]
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${++toastCounter}-${Date.now()}`
      setToasts((prev) => [...prev, { id, message, type }])
      // Auto-dismiss after 4 seconds
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const toast = useCallback(
    (message: string, type: ToastType = "info") => addToast(message, type),
    [addToast]
  )

  const success = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast]
  )

  const error = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast]
  )

  const info = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, info, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}