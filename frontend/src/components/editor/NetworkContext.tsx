"use client"

import React, { createContext, useContext, useState } from "react"
import type { StellarNetwork } from "@/lib/stellar/deploy"

interface NetworkContextType {
  network: StellarNetwork
  setNetwork: (network: StellarNetwork) => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

function getDefaultNetwork(): StellarNetwork {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toLowerCase() === "mainnet" ? "mainnet" : "testnet"
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<StellarNetwork>(getDefaultNetwork)

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider")
  }
  return context
}
