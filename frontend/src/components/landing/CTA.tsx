"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

export default function CTA() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28 border-t border-slate-900 bg-slate-950">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-96 w-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-purple-500/10 blur-[100px] opacity-70"></div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="relative rounded-3xl border border-slate-800 bg-slate-900/40 px-6 py-12 shadow-2xl backdrop-blur-md sm:px-12 sm:py-20 overflow-hidden">
          {/* Subtle design layers inside card */}
          <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-indigo-500/5 blur-[80px]"></div>
          <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-purple-500/5 blur-[80px]"></div>

          <div className="relative flex flex-col items-center max-w-2xl mx-auto">
            {/* Action Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/5 px-3 py-1 text-xs font-semibold text-indigo-400 backdrop-blur-sm mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free and Open Source</span>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Ready to Build on Stellar?
            </h2>
            
            {/* Description */}
            <p className="mt-6 text-sm sm:text-base text-slate-400 leading-relaxed">
              Drag blocks, wire up inputs, audit security states, and deploy optimized WebAssembly binaries straight to the Soroban environment in minutes.
            </p>

            {/* CTA Button */}
            <div className="mt-10">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-4.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.97] hover:opacity-95 transition-all"
              >
                Start Building Now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
