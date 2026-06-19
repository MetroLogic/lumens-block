import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { GENERATED_TEST_CARGO_TOML } from "./codegen"
import { compileGraphToWasm } from "./compiler"
import type { CompileError, ContractGraph } from "./schema"
import { generateContractTests } from "./testCodegen"
import type { ContractTestCase, ContractTestCaseResult, ContractTestRunResult } from "./test-schema"

const execFileAsync = promisify(execFile)

export interface TestRunOptions {
  cargoPath?: string
}

function compileError(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

function sanitizeTestFnName(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_")
  return cleaned.length > 0 ? cleaned : "case"
}

function parseCargoTestOutput(
  output: string,
  testCases: ContractTestCase[]
): ContractTestCaseResult[] {
  const lines = output.split("\n")
  const results = new Map<string, { passed: boolean; error?: string }>()

  for (const testCase of testCases) {
    const fnName = `lumens_test_${sanitizeTestFnName(testCase.id)}`
    const statusLine = lines.find((line) => line.includes(`contract_tests::${fnName}`))

    if (!statusLine) {
      results.set(testCase.id, {
        passed: false,
        error: "Test did not run (missing from cargo output).",
      })
      continue
    }

    if (statusLine.includes(" ... ok")) {
      results.set(testCase.id, { passed: true })
      continue
    }

    if (statusLine.includes(" ... FAILED")) {
      const marker = `---- contract_tests::${fnName} stdout ----`
      const markerIndex = lines.findIndex((line) => line.trim() === marker)
      const errorLines: string[] = []

      if (markerIndex >= 0) {
        for (let i = markerIndex + 1; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith("---- ") && line.endsWith(" ----")) break
          errorLines.push(line)
        }
      }

      results.set(testCase.id, {
        passed: false,
        error: errorLines.join("\n").trim() || "Test failed.",
      })
      continue
    }

    results.set(testCase.id, {
      passed: false,
      error: statusLine.trim(),
    })
  }

  return testCases.map((testCase) => {
    const parsed = results.get(testCase.id)
    return {
      id: testCase.id,
      name: testCase.name,
      passed: parsed?.passed ?? false,
      output: testCase.expected.output,
      error: parsed?.error,
    }
  })
}

/**
 * Compiles the contract to WASM, generates Soroban tests, and runs cargo test in a temp sandbox.
 */
export async function runContractTests(
  graph: ContractGraph,
  testCases: ContractTestCase[],
  options: TestRunOptions = {}
): Promise<{ ok: true; data: ContractTestRunResult } | { ok: false; error: CompileError }> {
  if (testCases.length === 0) {
    return {
      ok: false,
      error: compileError("NO_TEST_CASES", "At least one test case is required."),
    }
  }

  const compileResult = await compileGraphToWasm(graph, options)
  if (!compileResult.ok) {
    return { ok: false, error: compileResult.error }
  }

  let source: string
  try {
    source = generateContractTests(graph, testCases)
  } catch (err) {
    return {
      ok: false,
      error: compileError(
        "TEST_CODEGEN_FAILED",
        err instanceof Error ? err.message : "Failed to generate contract tests."
      ),
    }
  }

  const cargo = options.cargoPath ?? "cargo"
  let workDir: string | null = null

  try {
    workDir = await mkdtemp(join(tmpdir(), "lumens-block-test-"))
    const srcDir = join(workDir, "src")
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(workDir, "Cargo.toml"), GENERATED_TEST_CARGO_TOML, "utf8")
    await writeFile(join(srcDir, "lib.rs"), source, "utf8")

    const { stdout, stderr } = await execFileAsync(cargo, ["test", "--release", "--", "--nocapture"], {
      cwd: workDir,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: join(workDir, "target"),
      },
    })

    const combinedOutput = `${stdout}\n${stderr}`.trim()
    const caseResults = parseCargoTestOutput(combinedOutput, testCases)
    const allPassed = caseResults.every((result) => result.passed)

    return {
      ok: true,
      data: {
        allPassed,
        sourceHash: compileResult.data.sourceHash,
        sizeBytes: compileResult.data.sizeBytes,
        cases: caseResults,
        output: allPassed ? undefined : combinedOutput,
      },
    }
  } catch (err) {
    const combinedOutput = formatTestFailure(err)
    const caseResults = parseCargoTestOutput(combinedOutput, testCases).map((result) =>
      result.passed
        ? result
        : {
            ...result,
            error: result.error ?? "Contract tests failed to run.",
          }
    )

    return {
      ok: true,
      data: {
        allPassed: false,
        sourceHash: compileResult.data.sourceHash,
        sizeBytes: compileResult.data.sizeBytes,
        cases: caseResults.length > 0 ? caseResults : testCases.map((testCase) => ({
          id: testCase.id,
          name: testCase.name,
          passed: false,
          error: combinedOutput.slice(0, 500),
        })),
        output: combinedOutput,
      },
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

function formatTestFailure(err: unknown): string {
  if (err && typeof err === "object" && ("stderr" in err || "stdout" in err)) {
    const stderr = String((err as { stderr?: string }).stderr ?? "")
    const stdout = String((err as { stdout?: string }).stdout ?? "")
    return `${stdout}\n${stderr}`.trim()
  }

  if (err instanceof Error) {
    return err.message
  }

  return "Unknown test runner error."
}
