import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/editor/ThemeContext"
import { ToastProvider } from "@/components/editor/ToastProvider"
import { Toaster } from "@/components/editor/Toaster"

export const metadata: Metadata = {
  title: "LumensBlock",
  description: "Visual drag-and-drop platform for building smart contracts on Stellar",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}