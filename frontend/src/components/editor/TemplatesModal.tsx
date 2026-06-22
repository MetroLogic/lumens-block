"use client"

import React from "react"
import { X } from "lucide-react"
import { TEMPLATES, type TemplateMetadata } from "@/lib/templates"
import type { ContractGraph } from "@/lib/stellar/deploy"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (graph: ContractGraph) => void
}

function TemplateThumbnail({ templateId }: { templateId: string }) {
  if (templateId === "token-transfer") {
    return (
      <svg className="w-full h-24 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-2 dark:border-slate-700 dark:bg-slate-950" viewBox="0 0 300 100">
        {/* Start Node */}
        <rect x="10" y="35" width="50" height="30" rx="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="35" y="53" fill="#1e3a8a" fontSize="10" fontWeight="bold" textAnchor="middle">Start</text>
        
        {/* Arrow 1 */}
        <path d="M 60 50 L 80 50" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Auth Node */}
        <rect x="80" y="35" width="50" height="30" rx="6" fill="#faf5ff" stroke="#a855f7" strokeWidth="1.5" />
        <text x="105" y="53" fill="#581c87" fontSize="10" fontWeight="bold" textAnchor="middle">Auth Check</text>
        
        {/* Arrow 2 */}
        <path d="M 130 50 L 150 50" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Transfer Node */}
        <rect x="150" y="35" width="55" height="30" rx="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5" />
        <text x="177.5" y="53" fill="#064e3b" fontSize="10" fontWeight="bold" textAnchor="middle">Transfer</text>
        
        {/* Arrow 3 */}
        <path d="M 205 50 L 225 50" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Event Node */}
        <rect x="225" y="35" width="65" height="30" rx="6" fill="#f0f9ff" stroke="#0ea5e9" strokeWidth="1.5" />
        <text x="257.5" y="53" fill="#0c4a6e" fontSize="9" fontWeight="bold" textAnchor="middle">Emit Event</text>
        
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    )
  }
  
  if (templateId === "simple-escrow") {
    return (
      <svg className="w-full h-24 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-2 dark:border-slate-700 dark:bg-slate-950" viewBox="0 0 300 100">
        {/* Start Node */}
        <rect x="10" y="15" width="45" height="24" rx="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="32.5" y="30" fill="#1e3a8a" fontSize="9" fontWeight="bold" textAnchor="middle">Start</text>
        
        {/* Arrow 1 */}
        <path d="M 55 27 L 75 27" stroke="#94a3b8" strokeWidth="1.5" />
        
        {/* Auth Node */}
        <rect x="75" y="15" width="55" height="24" rx="6" fill="#faf5ff" stroke="#a855f7" strokeWidth="1.5" />
        <text x="102.5" y="30" fill="#581c87" fontSize="9" fontWeight="bold" textAnchor="middle">Verify Auth</text>
        
        {/* Branch Arrow Up to Storage */}
        <path d="M 130 27 L 150 27" stroke="#94a3b8" strokeWidth="1.5" />
        
        {/* Storage Node */}
        <rect x="150" y="15" width="55" height="24" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="177.5" y="30" fill="#78350f" fontSize="9" fontWeight="bold" textAnchor="middle">Lock Funds</text>

        {/* Arrow to Condition */}
        <path d="M 102.5 39 L 102.5 60 C 102.5 60 102.5 70 120 70 L 150 70" fill="none" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Condition Node */}
        <rect x="150" y="58" width="60" height="24" rx="6" fill="#fff1f2" stroke="#f43f5e" strokeWidth="1.5" />
        <text x="180" y="73" fill="#881337" fontSize="8" fontWeight="bold" textAnchor="middle">Release Cond?</text>

        {/* Arrow from Condition to Transfer */}
        <path d="M 210 70 L 235 70" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Transfer Node */}
        <rect x="235" y="58" width="55" height="24" rx="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5" />
        <text x="262.5" y="73" fill="#064e3b" fontSize="8" fontWeight="bold" textAnchor="middle">Release Funds</text>
        
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    )
  }

  // Access-Controlled Storage
  return (
    <svg className="w-full h-24 bg-gray-50 rounded-lg border border-dashed border-gray-200 p-2 dark:border-slate-700 dark:bg-slate-950" viewBox="0 0 300 100">
      {/* Start Node */}
      <rect x="10" y="35" width="40" height="30" rx="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
      <text x="30" y="53" fill="#1e3a8a" fontSize="10" fontWeight="bold" textAnchor="middle">Start</text>
      
      {/* Arrow 1 */}
      <path d="M 50 50 L 68 50" stroke="#94a3b8" strokeWidth="1.5" />
      
      {/* Auth Node */}
      <rect x="68" y="35" width="52" height="30" rx="6" fill="#faf5ff" stroke="#a855f7" strokeWidth="1.5" />
      <text x="94" y="53" fill="#581c87" fontSize="9" fontWeight="bold" textAnchor="middle">Require Owner</text>
      
      {/* Arrow 2 */}
      <path d="M 120 50 L 138 50" stroke="#94a3b8" strokeWidth="1.5" />
      
      {/* Condition Node */}
      <rect x="138" y="35" width="52" height="30" rx="6" fill="#fff1f2" stroke="#f43f5e" strokeWidth="1.5" />
      <text x="164" y="53" fill="#881337" fontSize="9" fontWeight="bold" textAnchor="middle">Valid Input?</text>
      
      {/* Arrow 3 */}
      <path d="M 190 50 L 208 50" stroke="#94a3b8" strokeWidth="1.5" />
      
      {/* Storage Node */}
      <rect x="208" y="35" width="42" height="30" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="229" y="53" fill="#78350f" fontSize="9" fontWeight="bold" textAnchor="middle">Storage</text>
      
      {/* Arrow 4 */}
      <path d="M 250 50 L 265 50" stroke="#94a3b8" strokeWidth="1.5" />
      
      {/* Event Node */}
      <rect x="265" y="35" width="30" height="30" rx="6" fill="#f0f9ff" stroke="#0ea5e9" strokeWidth="1.5" />
      <text x="280" y="53" fill="#0c4a6e" fontSize="9" fontWeight="bold" textAnchor="middle">Event</text>
    </svg>
  )
}

export default function TemplatesModal({ isOpen, onClose, onSelectTemplate }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto dark:border-slate-700 dark:bg-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Contract Templates</h2>
            <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
              Select a starter template graph to load onto your canvas and customize.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-500 hover:shadow-lg transition-all duration-300 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-400"
              onClick={() => onSelectTemplate(tmpl.graph)}
            >
              <div>
                {/* Thumbnail Preview */}
                <div className="mb-4 overflow-hidden rounded-lg">
                  <TemplateThumbnail templateId={tmpl.id} />
                </div>
                
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors dark:text-slate-100 dark:group-hover:text-blue-300">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed dark:text-slate-400">
                  {tmpl.description}
                </p>
              </div>

              <button className="mt-4 w-full py-2 bg-gray-50 hover:bg-blue-600 hover:text-white rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-600 dark:hover:text-white">
                Load Template
              </button>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  )
}
