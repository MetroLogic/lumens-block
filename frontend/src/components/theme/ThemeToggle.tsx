"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import {
  applyThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("light")

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
    const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
    const resolvedTheme = resolveThemePreference(storedPreference, prefersDarkMode)

    setTheme(resolvedTheme)
    applyThemePreference(resolvedTheme, document.documentElement)
    document.documentElement.style.colorScheme = resolvedTheme
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark"

    setTheme(nextTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    applyThemePreference(nextTheme, document.documentElement)
    document.documentElement.style.colorScheme = nextTheme
  }

  const isDark = theme === "dark"
  const Icon = isDark ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
    >
      <Icon size={15} />
    </button>
  )
}
