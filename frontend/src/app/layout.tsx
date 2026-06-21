import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LumensBlock",
  description: "Visual drag-and-drop platform for building smart contracts on Stellar",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
