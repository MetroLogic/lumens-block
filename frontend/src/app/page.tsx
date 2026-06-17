import { Metadata } from "next"
import Navbar from "@/components/landing/Navbar"
import Hero from "@/components/landing/Hero"
import HowItWorks from "@/components/landing/HowItWorks"
import Features from "@/components/landing/Features"
import TechStack from "@/components/landing/TechStack"
import CTA from "@/components/landing/CTA"
import Footer from "@/components/landing/Footer"

export const metadata: Metadata = {
  title: "LumensBlock — Visual Drag-and-Drop Soroban Smart Contract Builder on Stellar",
  description: "Build, configure, and deploy Stellar smart contracts visually without writing code. Drag-and-drop block editor, Freighter wallet deploy, and interactive dApp builder.",
  alternates: {
    canonical: "https://lumensblock.com",
  },
  openGraph: {
    title: "LumensBlock — Visual Smart Contract Builder on Stellar",
    description: "Build, configure, and deploy Stellar smart contracts visually without writing code. Drag-and-drop block editor, Freighter wallet deploy, and interactive dApp builder.",
    url: "https://lumensblock.com",
    siteName: "LumensBlock",
    images: [
      {
        url: "https://lumensblock.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "LumensBlock Visual Smart Contract Builder Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LumensBlock — Visual Smart Contract Builder on Stellar",
    description: "Build, configure, and deploy Stellar smart contracts visually without writing code.",
    images: ["https://lumensblock.com/og-image.png"],
  },
}

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LumensBlock",
    "operatingSystem": "All",
    "applicationCategory": "DeveloperApplication",
    "description": "Visual drag-and-drop platform for building smart contracts and dApps on Stellar — no code required.",
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "Metro Logic"
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 selection:text-blue-200 scroll-smooth">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <TechStack />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
