"use client"

import { useWallet, truncateKey } from "./WalletContext"
import { Wallet, LogOut, ExternalLink, Loader2 } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export default function ConnectWallet() {
  const { publicKey, isConnecting, error, isFreighterInstalled, connect, disconnect } =
    useWallet()

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  // Freighter not installed — show install link
  if (isFreighterInstalled === false) {
    return (
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        id="install-freighter-link"
        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
      >
        <ExternalLink size={14} />
        Install Freighter
      </a>
    )
  }

  // Connected — show truncated key + disconnect dropdown
  if (publicKey) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          id="wallet-connected-button"
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
        >
          <Wallet size={14} />
          {truncateKey(publicKey)}
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border bg-white py-1 shadow-lg z-50">
            <div className="px-3 py-2 text-[10px] text-gray-400 uppercase tracking-wider">
              Connected
            </div>
            <div className="px-3 py-1.5 text-xs text-gray-600 font-mono break-all select-all border-b border-gray-100">
              {publicKey}
            </div>
            <button
              id="wallet-disconnect-button"
              onClick={() => {
                disconnect()
                setShowMenu(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  // Disconnected — show connect button
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        id="connect-wallet-button"
        onClick={connect}
        disabled={isConnecting}
        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isConnecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Wallet size={14} />
        )}
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>

      {error && (
        <p className="text-[10px] text-red-500 max-w-[180px] text-right">
          {error}
        </p>
      )}
    </div>
  )
}
