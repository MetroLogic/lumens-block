import type { Metadata } from "next"
import { THEME_STORAGE_KEY } from "@/lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: "LumensBlock",
  description: "Visual drag-and-drop platform for building smart contracts on Stellar",
}

const themeScript = `
(function () {
  try {
    var storedPreference = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = storedPreference === "light" || storedPreference === "dark"
      ? storedPreference
      : prefersDarkMode
        ? "dark"
        : "light";

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (error) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-white text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  )
}
