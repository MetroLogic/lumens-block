"use client"

import { Cpu, ShieldCheck, Flame, Wallet } from "lucide-react"

export default function TechStack() {
  const techs = [
    {
      title: "Rust & Soroban Backend",
      description: "Compiles your visual block logic into pure Rust, compiling directly to Soroban-compatible WebAssembly (Wasm) smart contracts.",
      icon: Cpu
    },
    {
      title: "Stellar Network Speed",
      description: "Enjoy near-instant transaction execution, ultra-low fees, and robust, sustainable global scale operations.",
      icon: Flame
    },
    {
      title: "Freighter Wallet Integration",
      description: "Secure, non-custodial authorization. Sign contract transactions and deploy changes directly via Freighter or other compatible Stellar wallets.",
      icon: Wallet
    },
    {
      title: "Rust Memory Safety",
      description: "Compiles code leveraging Rust's compiler guarantees, ensuring lack of memory leaks, zero-cost abstractions, and runtime safety.",
      icon: ShieldCheck
    }
  ]

  return (
    <section id="tech-stack" className="relative border-t border-slate-900 bg-slate-950 py-20 lg:py-28">
      {/* Mesh background effects */}
      <div className="absolute top-1/2 left-1/4 -z-10 h-80 w-80 rounded-full bg-blue-600/[0.03] blur-[120px]"></div>
      <div className="absolute top-1/3 right-1/4 -z-10 h-80 w-80 rounded-full bg-purple-600/[0.03] blur-[120px]"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Info Side */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">CREDIBILITY & INFRASTRUCTURE</span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl leading-tight">
              Production-Ready Code. Stellar Capabilities.
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              LumensBlock isn't just a simulator. It compiles your logical canvas into standard Soroban smart contracts, giving you the full performance, safety, and speed of Stellar's next-generation Rust-based smart contract platform.
            </p>
            <div className="flex flex-wrap items-center gap-6 mt-2">
              <div className="flex items-center gap-2 text-sm text-slate-300 font-mono bg-slate-900/60 border border-slate-800/80 px-3.5 py-1.5 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                Soroban-Wasm
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300 font-mono bg-slate-900/60 border border-slate-800/80 px-3.5 py-1.5 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                Stellar Protocol
              </div>
            </div>
          </div>

          {/* Grid Side */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {techs.map((tech, idx) => {
              const Icon = tech.icon
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-900 bg-slate-900/10 p-6 hover:border-slate-800 hover:bg-slate-900/30 transition-all duration-300"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-blue-400 border border-slate-800/80 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200">
                    {tech.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    {tech.description}
                  </p>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </section>
  )
}
