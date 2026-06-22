export interface TransferAssetSelection {
  assetType: "native" | "sac"
  token?: string
  assetSymbol?: string
  assetName?: string
}

export interface AssetValidationResult {
  ok: boolean
  error?: string
}

export interface TokenMetadata {
  symbol?: string
  name?: string
}

const CONTRACT_ADDRESS_PATTERN = /^C[A-Z2-7]{55}$/

export function validateTransferAssetSelection(
  selection: TransferAssetSelection
): AssetValidationResult {
  if (selection.assetType === "native") {
    return { ok: true }
  }

  const token = selection.token?.trim()
  if (!token) {
    return { ok: false, error: "Enter a SAC contract address." }
  }

  if (!CONTRACT_ADDRESS_PATTERN.test(token)) {
    return { ok: false, error: "Enter a valid Stellar contract address that starts with C." }
  }

  return { ok: true }
}

export function formatAssetLabel(selection?: Partial<TransferAssetSelection>): string {
  if (!selection || selection.assetType === "native") {
    return "XLM"
  }

  if (selection.assetSymbol) {
    return selection.assetName ? `${selection.assetSymbol} (${selection.assetName})` : selection.assetSymbol
  }

  if (selection.token) {
    return `${selection.token.slice(0, 6)}...${selection.token.slice(-6)}`
  }

  return "Custom SAC"
}

export async function fetchSacTokenMetadata(token: string): Promise<TokenMetadata> {
  const validation = validateTransferAssetSelection({ assetType: "sac", token })
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const response = await fetch(`/api/token-metadata?token=${encodeURIComponent(token.trim())}`)
  const body = (await response.json()) as TokenMetadata | { error?: string }

  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Unable to fetch token metadata.")
  }

  return body as TokenMetadata
}
