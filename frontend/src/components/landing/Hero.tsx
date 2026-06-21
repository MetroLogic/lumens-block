"use client"

import Link from "next/link"
import { ArrowRight, Sparkles, Play, ShieldAlert, Coins } from "lucide-react"

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px] lg:h-96 lg:w-96"></div>
      <div className="absolute top-1/3 right-1/4 -z-10 h-80 w-80 rounded-full bg-purple-500/10 blur-[130px] lg:h-[450px] lg:w-[450px]"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 px-3 py-1 text-xs font-semibold text-blue-400 backdrop-blur-sm hover:bg-blue-500/10 transition-colors mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Visual Soroban Smart Contracts</span>
          </div>

          {/* Main Headline */}
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Build Stellar Smart Contracts.{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Without the Code.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed">
            LumensBlock makes on-chain logic visual. Drag and drop block components, configure logic parameters, and deploy directly to the Stellar network with one click.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
            <Link
              href="/editor"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-95 hover:scale-[1.03] active:scale-[0.97]"
            >
              Open Editor
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm px-8 py-4 text-base font-semibold text-slate-200 transition-all hover:bg-slate-800 hover:text-white hover:border-slate-700 hover:scale-[1.03] active:scale-[0.97]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>

        {/* Mock Editor Preview Layout */}
        <div className="relative mt-20 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-md lg:p-6">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-blue-500/5 to-purple-500/5 opacity-50"></div>
          
          {/* Header Bar of Mock Editor */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
              <span className="ml-2 text-xs font-medium text-slate-500 font-mono">my_soroban_contract.wasm</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 font-mono">Stellar Testnet</span>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
            </div>
          </div>

          {/* Visual Workspace Content */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 p-4 bg-slate-950/80 rounded-xl border border-slate-800/60 overflow-hidden min-h-[320px]">
            {/* SVG Connecting Flow Lines (Hidden on Mobile) */}
            <svg className="absolute inset-0 pointer-events-none hidden md:block" width="100%" height="100%">
              {/* Path 1 -> 2 */}
              <path
                d="M 290 160 Q 380 160 380 160"
                fill="none"
                stroke="url(#grad-blue)"
                strokeWidth="3"
                strokeDasharray="6,6"
              />
              {/* Path 2 -> 3 */}
              <path
                d="M 660 160 Q 750 160 750 160"
                fill="none"
                stroke="url(#grad-purple)"
                strokeWidth="3"
                strokeDasharray="6,6"
              />
              
              {/* Gradients */}
              <defs>
                <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              
              {/* Animated pulses */}
              <circle r="4" fill="#60a5fa">
                <animateMotion dur="4s" repeatCount="indefinite" path="M 290 160 Q 380 160 380 160" />
              </circle>
              <circle r="4" fill="#c084fc">
                <animateMotion dur="4s" repeatCount="indefinite" path="M 660 160 Q 750 160 750 160" />
              </circle>
            </svg>

            {/* Block 1: Auth */}
            <div className="z-10 flex flex-col justify-between rounded-xl border border-blue-500/30 bg-slate-900/95 p-5 shadow-lg shadow-blue-500/5 hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                    <Play className="h-3 w-3 fill-current" />
                    Entry point
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: 01</span>
                </div>
                <h3 className="text-base font-bold text-white">Initialize Contract</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Requires admin signature authentication to set contract owner variables.
                </p>
              </div>
              <div className="mt-4 border-t border-slate-800/80 pt-3 flex flex-col gap-1.5 text-2xs font-mono text-slate-500">
                <div className="flex justify-between">
                  <span>admin:</span>
                  <span className="text-blue-400">Address</span>
                </div>
              </div>
            </div>

            {/* Block 2: Condition */}
            <div className="z-10 flex flex-col justify-between rounded-xl border border-indigo-500/30 bg-slate-900/95 p-5 shadow-lg shadow-indigo-500/5 hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400">
                    <ShieldAlert className="h-3 w-3" />
                    Condition
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: 02</span>
                </div>
                <h3 className="text-base font-bold text-white">Verify Balance</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Asserts that the sender account holds at least the minimum required XLM balance.
                </p>
              </div>
              <div className="mt-4 border-t border-slate-800/80 pt-3 flex flex-col gap-1.5 text-2xs font-mono text-slate-500">
                <div className="flex justify-between">
                  <span>min_balance:</span>
                  <span className="text-indigo-400">100.0 XLM</span>
                </div>
              </div>
            </div>

            {/* Block 3: Action / Transfer */}
            <div className="z-10 flex flex-col justify-between rounded-xl border border-purple-500/30 bg-slate-900/95 p-5 shadow-lg shadow-purple-500/5 hover:border-purple-500/50 hover:shadow-purple-500/10 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400">
                    <Coins className="h-3 w-3" />
                    Action
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: 03</span>
                </div>
                <h3 className="text-base font-bold text-white">Execute Transfer</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Executes a cross-asset payment or transfer of XLM to the specified vault.
                </p>
              </div>
              <div className="mt-4 border-t border-slate-800/80 pt-3 flex flex-col gap-1.5 text-2xs font-mono text-slate-500">
                <div className="flex justify-between">
                  <span>recipient:</span>
                  <span className="text-purple-400">Vault_Addr</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
