"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"

interface WalletState {
  publicKey: string | null
  isConnecting: boolean
  error: string | null
  isFreighterInstalled: boolean | null
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const STORAGE_KEY = "lumens_wallet_publicKey"

function truncateKey(key: string): string {
  if (key.length <= 10) return key
  return `${key.slice(0, 5)}…${key.slice(-3)}`
}

export { truncateKey }

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    isConnecting: false,
    error: null,
    isFreighterInstalled: null,
  })

  // Check if Freighter is installed and restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const freighter = await import("@stellar/freighter-api")
        const connected = await freighter.isConnected()

        if (!connected) {
          setState((s) => ({ ...s, isFreighterInstalled: false }))
          return
        }

        setState((s) => ({ ...s, isFreighterInstalled: true }))

        // If we had a stored key, try to restore the session
        const storedKey =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null

        if (storedKey) {
          try {
            const pubKey = await freighter.getPublicKey()

            if (typeof pubKey === "string" && pubKey) {
              setState((s) => ({
                ...s,
                publicKey: pubKey,
              }))
              localStorage.setItem(STORAGE_KEY, pubKey)
            }
          } catch {
            // Session expired, clear stored key
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch {
        setState((s) => ({ ...s, isFreighterInstalled: false }))
      }
    }

    restore()
  }, [])

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }))

    try {
      const freighter = await import("@stellar/freighter-api")

      const connected = await freighter.isConnected()
      if (!connected) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          isFreighterInstalled: false,
          error: "Freighter extension is not installed",
        }))
        return
      }

      setState((s) => ({ ...s, isFreighterInstalled: true }))

      await freighter.requestAccess()

      const pubKey = await freighter.getPublicKey()

      let publicKey: string | null = null
      if (typeof pubKey === "string" && pubKey) {
        publicKey = pubKey
      }

      if (!publicKey) {
        throw new Error("Could not retrieve public key")
      }

      localStorage.setItem(STORAGE_KEY, publicKey)
      setState({
        publicKey,
        isConnecting: false,
        error: null,
        isFreighterInstalled: true,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet"
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: message,
      }))
    }
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState((s) => ({
      ...s,
      publicKey: null,
      error: null,
    }))
  }, [])

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return ctx
}
