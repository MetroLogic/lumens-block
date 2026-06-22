import { describe, expect, it, vi } from "vitest"

import { applyThemePreference, isThemePreference, resolveThemePreference } from "@/lib/theme"

describe("theme preference helpers", () => {
  it("accepts only supported stored theme values", () => {
    expect(isThemePreference("light")).toBe(true)
    expect(isThemePreference("dark")).toBe(true)
    expect(isThemePreference("system")).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })

  it("prefers an explicit stored preference", () => {
    expect(resolveThemePreference("light", true)).toBe("light")
    expect(resolveThemePreference("dark", false)).toBe("dark")
  })

  it("falls back to system preference on first load", () => {
    expect(resolveThemePreference(null, true)).toBe("dark")
    expect(resolveThemePreference(undefined, false)).toBe("light")
  })

  it("applies the dark class only for dark mode", () => {
    const root = {
      classList: {
        toggle: vi.fn(),
      },
    }

    applyThemePreference("dark", root)
    applyThemePreference("light", root)

    expect(root.classList.toggle).toHaveBeenNthCalledWith(1, "dark", true)
    expect(root.classList.toggle).toHaveBeenNthCalledWith(2, "dark", false)
  })
})
