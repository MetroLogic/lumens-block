import { describe, expect, it } from "vitest"

import { createToastId, toastReducer, type ToastMessage } from "./toastStore"

function message(id: string): ToastMessage {
  return {
    id,
    title: id,
    variant: "info",
    createdAt: 1,
  }
}

describe("toastReducer", () => {
  it("adds newest toasts first and caps the visible stack", () => {
    const state = ["a", "b", "c", "d", "e"].map(message)
    const next = toastReducer(state, { type: "add", toast: message("f") })

    expect(next.map((toast) => toast.id)).toEqual(["f", "a", "b", "c", "d"])
  })

  it("dismisses a single toast by id", () => {
    const next = toastReducer([message("a"), message("b")], { type: "dismiss", id: "a" })

    expect(next.map((toast) => toast.id)).toEqual(["b"])
  })

  it("clears all toasts", () => {
    const next = toastReducer([message("a"), message("b")], { type: "clear" })

    expect(next).toEqual([])
  })
})

describe("createToastId", () => {
  it("creates deterministic ids from supplied entropy", () => {
    expect(createToastId(1234, 0.5)).toBe("toast_ya_i")
  })
})
