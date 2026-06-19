"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react"
import type { Edge, Node } from "reactflow"
import {
  createDefaultTestCase,
  inferTestInputsFromGraph,
  runContractTestSuite,
  type ContractTestCase,
  type ContractTestRunResult,
} from "@/lib/stellar/test"

interface Props {
  nodes: Node[]
  edges: Edge[]
  onResultsChange: (result: ContractTestRunResult | null) => void
}

function createEmptyCase(graph: { nodes: Node[]; edges: Edge[] }): ContractTestCase {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "New test",
    inputs: inferTestInputsFromGraph(graph),
    expected: { success: true },
  }
}

export default function TestsPanel({ nodes, edges, onResultsChange }: Props) {
  const [isOpen, setIsOpen] = useState(true)
  const [testCases, setTestCases] = useState<ContractTestCase[]>(() => [
    createDefaultTestCase({ nodes, edges }),
  ])
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle")
  const [result, setResult] = useState<ContractTestRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inferredInputs = useMemo(
    () => inferTestInputsFromGraph({ nodes, edges }),
    [nodes, edges]
  )

  useEffect(() => {
    onResultsChange(result)
  }, [result, onResultsChange])

  const handleRunTests = async () => {
    setStatus("running")
    setError(null)
    setResult(null)

    try {
      const runResult = await runContractTestSuite({ graph: { nodes, edges }, testCases })
      setResult(runResult)
      setStatus("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run contract tests.")
      setStatus("done")
      onResultsChange(null)
    }
  }

  const handleAddCase = () => {
    const next = createEmptyCase({ nodes, edges })
    setTestCases((cases) => [...cases, next])
    setExpandedCaseId(next.id)
  }

  const handleRemoveCase = (id: string) => {
    setTestCases((cases) => {
      const next = cases.filter((testCase) => testCase.id !== id)
      return next.length > 0 ? next : [createEmptyCase({ nodes, edges })]
    })
  }

  const handleUpdateCase = (id: string, patch: Partial<ContractTestCase>) => {
    setTestCases((cases) =>
      cases.map((testCase) => (testCase.id === id ? { ...testCase, ...patch } : testCase))
    )
  }

  const handleInputChange = (caseId: string, inputName: string, value: string) => {
    setTestCases((cases) =>
      cases.map((testCase) => {
        if (testCase.id !== caseId) return testCase
        return {
          ...testCase,
          inputs: testCase.inputs.map((input) =>
            input.name === inputName ? { ...input, value } : input
          ),
        }
      })
    )
  }

  const syncInputsWithGraph = (caseId: string) => {
    setTestCases((cases) =>
      cases.map((testCase) => {
        if (testCase.id !== caseId) return testCase
        const merged = inferredInputs.map((input) => {
          const existing = testCase.inputs.find((candidate) => candidate.name === input.name)
          return existing ?? input
        })
        return { ...testCase, inputs: merged }
      })
    )
  }

  const resultByCaseId = new Map(result?.cases.map((caseResult) => [caseResult.id, caseResult]))

  return (
    <div className="absolute right-4 top-4 z-10 flex w-[360px] max-h-[calc(100%-6rem)] flex-col rounded-lg border bg-white shadow-md">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center justify-between border-b px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Tests</p>
          <p className="text-xs text-gray-400">Input values → expected output</p>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {testCases.map((testCase) => {
              const caseResult = resultByCaseId.get(testCase.id)
              const isExpanded = expandedCaseId === testCase.id

              return (
                <div key={testCase.id} className="rounded-lg border border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setExpandedCaseId(isExpanded ? null : testCase.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {caseResult ? (
                        caseResult.passed ? (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-red-500 shrink-0" />
                        )
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-gray-300 shrink-0" />
                      )}
                      <span className="truncate text-sm font-medium text-gray-800">{testCase.name}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={testCase.name}
                          onChange={(e) => handleUpdateCase(testCase.id, { name: e.target.value })}
                          className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCase(testCase.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${testCase.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase text-gray-500">Inputs</p>
                          <button
                            type="button"
                            onClick={() => syncInputsWithGraph(testCase.id)}
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                          >
                            Sync from graph
                          </button>
                        </div>
                        {testCase.inputs.length === 0 ? (
                          <p className="text-xs italic text-gray-400">No inputs inferred from graph.</p>
                        ) : (
                          testCase.inputs.map((input) => (
                            <div key={input.name} className="space-y-1">
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                <span>{input.name}</span>
                                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                                  {input.type}
                                </span>
                              </label>
                              <input
                                type="text"
                                value={input.value}
                                placeholder={
                                  input.type === "address"
                                    ? "Leave blank for generated address"
                                    : input.type === "boolean"
                                    ? "true / false"
                                    : ""
                                }
                                onChange={(e) => handleInputChange(testCase.id, input.name, e.target.value)}
                                className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                              />
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-gray-500">Expected</p>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={testCase.expected.success}
                            onChange={(e) =>
                              handleUpdateCase(testCase.id, {
                                expected: { ...testCase.expected, success: e.target.checked },
                              })
                            }
                          />
                          Contract call succeeds
                        </label>
                        <input
                          type="text"
                          value={testCase.expected.output ?? ""}
                          placeholder="Optional expected output"
                          onChange={(e) =>
                            handleUpdateCase(testCase.id, {
                              expected: {
                                ...testCase.expected,
                                output: e.target.value.length > 0 ? e.target.value : undefined,
                              },
                            })
                          }
                          className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>

                      {caseResult && !caseResult.passed && caseResult.error && (
                        <div className="rounded border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
                          <div className="mb-1 flex items-center gap-1 font-semibold">
                            <AlertCircle size={12} />
                            Failure output
                          </div>
                          <pre className="whitespace-pre-wrap break-words font-mono">{caseResult.error}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={handleAddCase}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
            >
              <Plus size={14} />
              Add test case
            </button>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {result && (
              <div
                className={`rounded border px-3 py-2 text-xs ${
                  result.allPassed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {result.allPassed
                  ? `All ${result.cases.length} tests passed against WASM (${result.sizeBytes} bytes).`
                  : `${result.cases.filter((caseResult) => !caseResult.passed).length} of ${result.cases.length} tests failed.`}
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3">
            <button
              type="button"
              onClick={handleRunTests}
              disabled={status === "running" || testCases.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {status === "running" ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running tests…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run tests
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
