import { NextRequest, NextResponse } from "next/server"

import { validateTransferAssetSelection } from "@/lib/stellar/assets"
import { fetchSacTokenMetadataFromRpc } from "@/lib/stellar/tokenMetadata"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? ""
  const validation = validateTransferAssetSelection({ assetType: "sac", token })

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const metadata = await fetchSacTokenMetadataFromRpc(token)
    return NextResponse.json(metadata)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch token metadata."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
