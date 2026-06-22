import type { BlockParameters, BlockType } from "@/lib/compile/schema"

export interface BlockConfigData {
  label: string
  params?: BlockParameters
}

export interface ConfigField {
  key: keyof BlockParameters
  label: string
  placeholder: string
  helper: string
}

export const CONFIG_FIELDS: Partial<Record<BlockType, ConfigField[]>> = {
  Transfer: [
    {
      key: "token",
      label: "Token contract",
      placeholder: "C...",
      helper: "Stellar Asset Contract address used by the generated transfer call.",
    },
  ],
  Storage: [
    {
      key: "storageKey",
      label: "Storage key",
      placeholder: "escrow",
      helper: "Short symbolic key used when this block writes to instance storage.",
    },
  ],
  Event: [
    {
      key: "eventName",
      label: "Event name",
      placeholder: "transfer",
      helper: "Symbolic event name for indexers and downstream contract observers.",
    },
  ],
  Condition: [
    {
      key: "condition",
      label: "Condition expression",
      placeholder: "release == true",
      helper: "Human-readable guard that documents when this branch should continue.",
    },
  ],
}

export function getConfigFields(type: string | undefined): ConfigField[] {
  return CONFIG_FIELDS[(type ?? "default") as BlockType] ?? []
}

export function mergeBlockConfig(
  current: BlockConfigData | undefined,
  patch: { label?: string; params?: Partial<BlockParameters> }
): BlockConfigData {
  const currentParams = current?.params ?? {}
  const nextParams =
    patch.params === undefined
      ? currentParams
      : Object.fromEntries(
          Object.entries({ ...currentParams, ...patch.params }).filter(([, value]) => {
            return typeof value === "string" && value.trim().length > 0
          })
        )

  return {
    label: patch.label ?? current?.label ?? "Block",
    ...(Object.keys(nextParams).length > 0 ? { params: nextParams as BlockParameters } : {}),
  }
}
