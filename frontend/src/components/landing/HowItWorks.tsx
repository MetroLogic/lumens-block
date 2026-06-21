"use client"

import { MousePointerClick, Sliders, Rocket } from "lucide-react"

export default function HowItWorks() {
  const steps = [
    {
      id: "01",
      title: "Stack Blocks",
      description: "Select from our menu of ready-to-use smart contract primitives. Drag logic gates, authorization guards, and asset handlers onto the editor workspace.",
      icon: MousePointerClick,
      color: "from-blue-500 to-indigo-500",
      glowColor: "shadow-blue-500/10",
      svg: (
        <svg className="w-full h-32 text-blue-500/80" fill="none" viewBox="0 0 200 120" stroke="currentColor">
          <rect x="20" y="20" width="120" height="40" rx="8" fill="rgba(30, 41, 59, 0.7)" stroke="currentColor" strokeWidth="1.5" />
          <text x="35" y="45" fill="white" fontSize="11" fontFamily="monospace" fontWeight="600">Auth Guard</text>
          
          <rect x="60" y="75" width="120" height="40" rx="8" fill="rgba(59, 130, 246, 0.15)" stroke="currentColor" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
          <text x="75" y="100" fill="#60a5fa" fontSize="11" fontFamily="monospace" fontWeight="600">Transfer XLM</text>
          
          <path d="M 80 40 L 80 75" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrow)" />
          <circle cx="80" cy="57" r="3" fill="#60a5fa" className="animate-ping" />
        </svg>
      )
    },
    {
      id: "02",
      title: "Configure Logic",
      description: "Configure settings, inputs, and safety thresholds directly inside the parameters drawer. Map inputs to outputs and establish transaction validations without coding.",
      icon: Sliders,
      color: "from-indigo-500 to-purple-500",
      glowColor: "shadow-indigo-500/10",
      svg: (
        <svg className="w-full h-32 text-indigo-500/80" fill="none" viewBox="0 0 200 120" stroke="currentColor">
          {/* Slider 1 */}
          <line x1="30" y1="40" x2="170" y2="40" stroke="rgba(71, 85, 105, 0.5)" strokeWidth="4" strokeLinecap="round" />
          <line x1="30" y1="40" x2="110" y2="40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="110" cy="40" r="8" fill="white" stroke="#6366f1" strokeWidth="3" className="cursor-pointer" />
          
          {/* Slider 2 */}
          <line x1="30" y1="80" x2="170" y2="80" stroke="rgba(71, 85, 105, 0.5)" strokeWidth="4" strokeLinecap="round" />
          <line x1="30" y1="80" x2="150" y2="80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="150" cy="80" r="8" fill="white" stroke="#a855f7" strokeWidth="3" className="cursor-pointer" />
          
          <text x="30" y="25" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">LIMIT AMOUNT (XLM)</text>
          <text x="30" y="65" fill="#94a3b8" fontSize="9" fontFamily="sans-serif">MAX FEE (STROOPS)</text>
        </svg>
      )
    },
    {
      id: "03",
      title: "One-Click Deploy",
      description: "Compile contract visual trees into standard WebAssembly (Wasm) bytecode optimized for Stellar. Deploys onto Stellar Mainnet or Testnet via Freighter wallet.",
      icon: Rocket,
      color: "from-purple-500 to-pink-500",
      glowColor: "shadow-purple-500/10",
      svg: (
        <svg className="w-full h-32 text-purple-500/80" fill="none" viewBox="0 0 200 120" stroke="currentColor">
          <circle cx="100" cy="60" r="35" fill="rgba(168, 85, 247, 0.05)" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3" />
          <path d="M 100 40 L 100 80 M 80 60 L 120 60" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
          
          {/* Orbiting particles */}
          <circle cx="100" cy="25" r="4" fill="#a855f7">
            <animateTransform attributeName="transform" type="rotate" from="0 100 60" to="360 100 60" dur="4s" repeatCount="indefinite" />
          </circle>
          
          <rect x="45" y="95" width="110" height="20" rx="4" fill="#1e293b" stroke="#334155" />
          <text x="100" y="108" textAnchor="middle" fill="#22c55e" fontSize="9" fontFamily="monospace" fontWeight="bold">DEPLOYED SUCCESSFULLY</text>
        </svg>
      )
    }
  ]

  return (
    <section id="how-it-works" className="relative border-t border-slate-900 bg-slate-950 py-20 lg:py-28">
      {/* Visual background accents */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.02] blur-[150px]"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Contract Development, Reimagined
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A visual pipeline mapping from drag-and-drop elements down to on-chain Soroban deployment.
          </p>
        </div>

        {/* Step Cards Grid */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8 relative">
          {/* Connection Lines (Desktop only) */}
          <div className="absolute top-1/3 left-1/4 right-1/4 h-0.5 border-t border-slate-800 border-dashed -z-10 hidden lg:block"></div>
          
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className={`relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/20 p-8 shadow-xl ${step.glowColor} backdrop-blur-sm hover:border-slate-700/60 hover:bg-slate-900/30 transition-all duration-300 group`}
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr ${step.color} text-white shadow-md`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-4xl font-extrabold text-slate-800/80 select-none font-mono">
                      {step.id}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* SVG Visual Graphic Container */}
                <div className="mt-8 rounded-lg bg-slate-950/60 p-4 border border-slate-900 flex items-center justify-center">
                  {step.svg}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
