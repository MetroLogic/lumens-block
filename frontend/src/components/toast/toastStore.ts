export type ToastVariant = "success" | "error" | "info"

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  createdAt: number
}

export type ToastAction =
  | { type: "add"; toast: ToastMessage }
  | { type: "dismiss"; id: string }
  | { type: "clear" }

export function toastReducer(state: ToastMessage[], action: ToastAction): ToastMessage[] {
  switch (action.type) {
    case "add":
      return [action.toast, ...state].slice(0, 5)
    case "dismiss":
      return state.filter((toast) => toast.id !== action.id)
    case "clear":
      return []
    default:
      return state
  }
}

export function createToastId(now: number, randomValue: number): string {
  return `toast_${now.toString(36)}_${randomValue.toString(36).slice(2, 8)}`
}
