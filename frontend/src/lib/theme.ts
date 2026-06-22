export type ThemePreference = "light" | "dark"

export const THEME_STORAGE_KEY = "lumens-block:theme"

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark"
}

export function resolveThemePreference(
  storedPreference: unknown,
  prefersDarkMode: boolean
): ThemePreference {
  if (isThemePreference(storedPreference)) {
    return storedPreference
  }

  return prefersDarkMode ? "dark" : "light"
}

interface ThemeRoot {
  classList: Pick<DOMTokenList, "toggle">
}

export function applyThemePreference(theme: ThemePreference, root: ThemeRoot) {
  root.classList.toggle("dark", theme === "dark")
}
