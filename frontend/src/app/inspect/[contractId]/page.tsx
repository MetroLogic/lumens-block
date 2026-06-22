import Link from "next/link"

import InspectorCanvas from "@/components/inspect/InspectorCanvas"
import ShareInspectButton from "@/components/inspect/ShareInspectButton"
import { buildInspectorGraph, inspectContract } from "@/lib/stellar/contractInspector"
import type { StellarNetwork } from "@/lib/stellar/deploy"

interface InspectPageProps {
  params: { contractId: string }
  searchParams: { network?: string }
}

export default async function InspectPage({ params, searchParams }: InspectPageProps) {
  const network: StellarNetwork = searchParams.network === "mainnet" ? "mainnet" : "testnet"
  const result = await inspectContract(params.contractId, network)
  const graph = buildInspectorGraph(result)
  const shareUrl = `/inspect/${params.contractId}?network=${network}`

  return (
    <main className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-800">
              LumensBlock
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Contract Inspector</h1>
            <p className="mt-1 break-all text-sm text-slate-600">{params.contractId}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium capitalize text-slate-700">
              {network}
            </span>
            <ShareInspectButton url={shareUrl} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-white">
          {result.status === "ready" ? (
            <InspectorCanvas nodes={graph.nodes} edges={graph.edges} />
          ) : (
            <div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-900">Unable to inspect this contract</p>
                <p className="mt-2 max-w-md text-sm text-slate-600">{result.error}</p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {result.error && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {result.error}
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Detail label="Status" value={result.status} />
              <Detail label="Latest ledger" value={result.latestLedger ?? "Unknown"} />
              <Detail label="WASM hash" value={result.wasmHash ?? "Not available"} mono />
              <Detail label="Created ledger" value={result.createdLedger ?? "Unknown"} />
              <Detail label="Storage entries" value={result.storageEntries.length} />
              <Detail label="Methods" value={result.methods.length} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Methods</h2>
            <div className="mt-3 space-y-3">
              {result.methods.length > 0 ? (
                result.methods.map((method) => (
                  <div key={method.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="font-semibold text-slate-900">{method.name}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {(method.inputs.length > 0 ? method.inputs.join(", ") : "no inputs") +
                        " -> " +
                        (method.outputs.length > 0 ? method.outputs.join(", ") : "void")}
                    </div>
                    {method.doc && <p className="mt-2 text-xs text-slate-500">{method.doc}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No contract spec methods were found in the WASM code entry.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Storage</h2>
            <div className="mt-3 space-y-2 text-sm">
              {result.storageEntries.length > 0 ? (
                result.storageEntries.map((entry) => (
                  <div key={`${entry.key}-${entry.value}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="break-all font-medium text-slate-900">{entry.key}</div>
                    <div className="mt-1 break-all text-xs text-slate-600">{entry.value}</div>
                  </div>
                ))
              ) : (
                <p className="text-slate-600">No instance storage entries were found.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Raw Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {Object.entries(result.rawDetails).map(([label, value]) => (
                <Detail key={label} label={label} value={value ?? "Not available"} mono={typeof value === "string" && value.length > 20} />
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  )
}
