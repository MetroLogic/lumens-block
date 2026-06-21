"use client"

import { Layers, Zap, LayoutGrid, Award, CheckCircle } from "lucide-react"

export default function Features() {
  const features = [
    {
      title: "Drag-and-Drop Block Editor",
      description: "Assemble contract branches visually. Drag authorization layers, storage keys, logic forks, and transfer triggers onto the canvas. No coding syntax required.",
      icon: Layers,
      color: "text-blue-400 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40",
      bullets: ["Visual logic components", "Auto-checking connections", "Wasm generation ready"]
    },
    {
      title: "One-Click Wallet Deployment",
      description: "Integrate with Stellar's Freighter wallet or similar credentials. Select your target network and deploy compiled contracts in a click. No CLI toolkits needed.",
      icon: Zap,
      color: "text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40",
      bullets: ["Freighter Wallet integration", "Testnet and Mainnet support", "Low-cost Stellar gas fees"]
    },
    {
      title: "Interactive dApp Builder",
      description: "Quickly export a responsive frontend interface matched with your contract variables. Let users interact, call functions, and inspect properties.",
      icon: LayoutGrid,
      color: "text-purple-400 border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40",
      bullets: ["React components generator", "Interactive client UI", "Built-in explorer actions"]
    },
    {
      title: "No-Code Friendly Environment",
      description: "Skip learning Rust, Cargo, or Soroban setup files. Build proof of concepts and launch functional blockchain tools in minutes instead of weeks.",
      icon: Award,
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40",
      bullets: ["Low barrier of entry", "Instant visual response", "Designed for designers & PMs"]
    }
  ]

  return (
    <section id="features" className="relative border-t border-slate-900 bg-slate-950 py-20 lg:py-28">
      {/* Background gradients */}
      <div className="absolute top-10 right-10 -z-10 h-72 w-72 rounded-full bg-purple-500/[0.02] blur-[100px]"></div>
      <div className="absolute bottom-10 left-10 -z-10 h-72 w-72 rounded-full bg-blue-500/[0.02] blur-[100px]"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to build on Stellar
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Skip the boilerplate environment setups. Assemble logic visually and deploy directly.
          </p>
        </div>

        {/* Features Card Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <div
                key={idx}
                className={`flex flex-col justify-between rounded-2xl border p-8 backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl ${feature.color}`}
              >
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Bullets */}
                <ul className="mt-8 space-y-2.5 border-t border-slate-900 pt-6">
                  {feature.bullets.map((bullet, bulletIdx) => (
                    <li key={bulletIdx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle className="h-3.5 w-3.5 text-slate-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
