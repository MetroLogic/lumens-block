"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useReactFlow } from "reactflow"
import { X, Plus, Trash2 } from "lucide-react"
import type { Node } from "reactflow"
import type { BlockParameters } from "@/lib/compile/schema"

// ---------------------------------------------------------------------------
// Tailwind class constants
// ---------------------------------------------------------------------------

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
const inputClass =
  "w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
const selectClass = inputClass
const sectionClass = "space-y-2.5 border-b border-slate-100 pb-3 last:border-b-0 dark:border-slate-700"
const btnDangerClass =
  "flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[10px] font-medium " +
  "text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 " +
  "dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"

// ---------------------------------------------------------------------------
// Type-specific form sections
// ---------------------------------------------------------------------------

interface SectionProps {
  nodeId: string
  params: BlockParameters
  onUpdate: (nodeId: string, patch: Partial<BlockParameters>) => void
}

function TransferSection({ nodeId, params, onUpdate }: SectionProps) {
  return (
    <div className={sectionClass}>
      <p className={labelClass}>Transfer</p>
      <div>
        <label className={labelClass}>Amount</label>
        <input
          className={inputClass}
          type="number"
          min="0"
          step="0.0000001"
          placeholder="e.g. 100"
          value={params.amount ?? ""}
          onChange={(e) => onUpdate(nodeId, { amount: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Recipient</label>
        <input
          className={inputClass}
          placeholder="G... Stellar address"
          value={params.recipient ?? ""}
          onChange={(e) => onUpdate(nodeId, { recipient: e.target.value })}
        />
      </div>
    </div>
  )
}

function StorageSection({ nodeId, params, onUpdate }: SectionProps) {
  return (
    <div className={sectionClass}>
      <p className={labelClass}>Storage</p>
      <div>
        <label className={labelClass}>Key</label>
        <input
          className={inputClass}
          placeholder="e.g. user_balance"
          value={params.storageKey ?? ""}
          onChange={(e) => onUpdate(nodeId, { storageKey: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Value Type</label>
        <select
          className={selectClass}
          value={params.valueType ?? "number"}
          onChange={(e) =>
            onUpdate(nodeId, { valueType: e.target.value as "string" | "number" | "bool" })
          }
        >
          <option value="number">Number (i128)</option>
          <option value="string">String (Symbol)</option>
          <option value="bool">Boolean</option>
        </select>
      </div>
    </div>
  )
}

function EventSection({ nodeId, params, onUpdate }: SectionProps) {
  const addField = () => {
    const fields = params.payloadFields ?? []
    onUpdate(nodeId, { payloadFields: [...fields, { name: "", valueType: "string" }] })
  }

  const removeField = (index: number) => {
    const fields = params.payloadFields ?? []
    onUpdate(nodeId, { payloadFields: fields.filter((_, i) => i !== index) })
  }

  const updateField = (index: number, patch: Partial<{ name: string; valueType: "string" | "number" | "bool" }>) => {
    const fields = params.payloadFields ?? []
    onUpdate(nodeId, {
      payloadFields: fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    })
  }

  return (
    <div className={sectionClass}>
      <p className={labelClass}>Event</p>
      <div>
        <label className={labelClass}>Event Name</label>
        <input
          className={inputClass}
          placeholder="e.g. transfer_initiated"
          value={params.eventName ?? ""}
          onChange={(e) => onUpdate(nodeId, { eventName: e.target.value })}
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelClass}>Payload Fields</label>
          <button
            onClick={addField}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
          >
            <Plus size={11} /> Add
          </button>
        </div>
        <div className="space-y-1.5">
          {(params.payloadFields ?? []).map((field, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={inputClass + " flex-1"}
                placeholder="Field name"
                value={field.name}
                onChange={(e) => updateField(i, { name: e.target.value })}
              />
              <select
                className={selectClass + " w-20 flex-shrink-0"}
                value={field.valueType ?? "string"}
                onChange={(e) =>
                  updateField(i, { valueType: e.target.value as "string" | "number" | "bool" })
                }
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="bool">Bool</option>
              </select>
              <button
                onClick={() => removeField(i)}
                className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50"
                aria-label="Remove field"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuthSection({ nodeId, params, onUpdate }: SectionProps) {
  const [addressInput, setAddressInput] = useState("")

  const addAddress = () => {
    const addr = addressInput.trim()
    if (!addr) return
    const current = params.allowedAddresses ?? []
    if (current.includes(addr)) return
    onUpdate(nodeId, { allowedAddresses: [...current, addr] })
    setAddressInput("")
  }

  const removeAddress = (addr: string) => {
    onUpdate(nodeId, {
      allowedAddresses: (params.allowedAddresses ?? []).filter((a) => a !== addr),
    })
  }

  return (
    <div className={sectionClass}>
      <p className={labelClass}>Authorization</p>
      <div>
        <label className={labelClass}>Required Signers</label>
        <input
          className={inputClass}
          type="number"
          min="1"
          max="20"
          placeholder="e.g. 2"
          value={params.requiredSigners ?? ""}
          onChange={(e) => onUpdate(nodeId, { requiredSigners: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Allowed Signers</label>
        <div className="flex items-center gap-1">
          <input
            className={inputClass + " flex-1"}
            placeholder="G... Stellar address"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addAddress()
            }}
          />
          <button
            onClick={addAddress}
            className="flex-shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          >
            Add
          </button>
        </div>
        <div className="mt-1.5 space-y-1">
          {(params.allowedAddresses ?? []).map((addr) => (
            <div
              key={addr}
              className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="truncate text-[10px] font-mono text-slate-600 dark:text-slate-300">
                {addr}
              </span>
              <button
                onClick={() => removeAddress(addr)}
                className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50"
                aria-label={`Remove ${addr}`}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConfigPanel — slide-in drawer for node configuration
// ---------------------------------------------------------------------------

interface ConfigPanelProps {
  selectedNode: Node
  onClose: () => void
}

export default function ConfigPanel({ selectedNode, onClose }: ConfigPanelProps) {
  const { setNodes } = useReactFlow()
  const panelRef = useRef<HTMLDivElement>(null)
  const params = (selectedNode.data?.params ?? {}) as BlockParameters
  const nodeType = selectedNode.type ?? "default"

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  // Focus the panel on mount
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const onUpdate = useCallback(
    (nodeId: string, patch: Partial<BlockParameters>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            data: {
              ...n.data,
              params: {
                ...(n.data.params as BlockParameters ?? {}),
                ...patch,
              },
            },
          }
        })
      )
    },
    [setNodes]
  )

  const onUpdateLabel = (label: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode.id) return n
        return {
          ...n,
          data: {
            ...n.data,
            label,
          },
        }
      })
    )
  }

  const typeLabel = nodeType === "default" ? "Start" : nodeType

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/10"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`${typeLabel} configuration`}
        aria-modal="true"
        tabIndex={-1}
        className="absolute right-0 top-0 z-40 h-full w-72 overflow-y-auto border-l border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {typeLabel}
            </p>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close configuration panel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          {/* Label (common to all non-default types) */}
          <div className={sectionClass}>
            <div>
              <label className={labelClass}>Label</label>
              <input
                className={inputClass}
                placeholder="Block label"
                value={selectedNode.data?.label ?? ""}
                onChange={(e) => onUpdateLabel(e.target.value)}
              />
            </div>
          </div>

          {/* Type-specific sections */}
          {nodeType === "Transfer" && (
            <TransferSection nodeId={selectedNode.id} params={params} onUpdate={onUpdate} />
          )}
          {nodeType === "Storage" && (
            <StorageSection nodeId={selectedNode.id} params={params} onUpdate={onUpdate} />
          )}
          {nodeType === "Event" && (
            <EventSection nodeId={selectedNode.id} params={params} onUpdate={onUpdate} />
          )}
          {nodeType === "Auth" && (
            <AuthSection nodeId={selectedNode.id} params={params} onUpdate={onUpdate} />
          )}
          {nodeType === "Condition" && (
            <div className={sectionClass}>
              <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                Use the inline panel on the node to configure the condition expression.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}