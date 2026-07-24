import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/editor/ThemeContext"
import { NetworkProvider } from "@/components/editor/NetworkContext"

export const metadata: Metadata = {
  title: "LumensBlock",
  description: "Visual drag-and-drop platform for building smart contracts on Stellar",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <NetworkProvider>{children}</NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
