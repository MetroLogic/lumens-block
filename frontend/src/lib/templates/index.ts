import tokenTransfer from "./token-transfer.json"
import simpleEscrow from "./simple-escrow.json"
import accessControlledStorage from "./access-controlled-storage.json"
import type { ContractGraph } from "../stellar/deploy"

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  graph: ContractGraph
}

export const TEMPLATES: TemplateMetadata[] = [
  {
    id: "token-transfer",
    name: "Token Transfer",
    description: "Authorize and execute an on-chain transfer of tokens from sender to receiver, emitting a transfer event.",
    graph: tokenTransfer as ContractGraph,
  },
  {
    id: "simple-escrow",
    name: "Simple Escrow",
    description: "Verify sender auth, lock funds in contract storage, and release them to the beneficiary once conditions are met.",
    graph: simpleEscrow as ContractGraph,
  },
  {
    id: "access-controlled-storage",
    name: "Access-Controlled Storage",
    description: "Restricted state mutation requiring owner authorization before modifying key-value contract storage.",
    graph: accessControlledStorage as ContractGraph,
  },
]
