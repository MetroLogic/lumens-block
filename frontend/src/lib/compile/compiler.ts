import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { GENERATED_CARGO_TOML, generateContractSource } from "./codegen"
import { CompileError, CompileSuccess, ContractGraph } from "./schema"

const execFileAsync = promisify(execFile)

export interface CompileOptions {
  /** Override path to cargo binary (useful in tests). */
  cargoPath?: string
  /** Skip actual WASM compilation and return source only (for tests). */
  dryRun?: boolean
}

function compileError(code: string, message: string, details?: string[]): CompileError {
  return { code, message, details }
}

/**
 * Writes generated source to a temp crate and compiles to WASM via cargo.
 */
export async function compileGraphToWasm(
  graph: ContractGraph,
  options: CompileOptions = {}
): Promise<{ ok: true; data: CompileSuccess } | { ok: false; error: CompileError }> {
  let generated: ReturnType<typeof generateContractSource>

  try {
    generated = generateContractSource(graph)
  } catch (err) {
    return {
      ok: false,
      error: compileError(
        "CODEGEN_FAILED",
        err instanceof Error ? err.message : "Failed to generate contract source."
      ),
    }
  }

  if (options.dryRun) {
    const sourceBuffer = Buffer.from(generated.source, "utf8")
    return {
      ok: true,
      data: {
        wasm: sourceBuffer.toString("base64"),
        sourceHash: generated.sourceHash,
        sizeBytes: sourceBuffer.length,
      },
    }
  }

  const cargo = options.cargoPath ?? "cargo"
  let workDir: string | null = null

  try {
    workDir = await mkdtemp(join(tmpdir(), "lumens-block-compile-"))
    const srcDir = join(workDir, "src")
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(workDir, "Cargo.toml"), GENERATED_CARGO_TOML, "utf8")
    await writeFile(join(srcDir, "lib.rs"), generated.source, "utf8")

    await execFileAsync(
      cargo,
      ["build", "--target", "wasm32-unknown-unknown", "--release"],
      {
        cwd: workDir,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          CARGO_TARGET_DIR: join(workDir, "target"),
        },
      }
    )

    const wasmPath = join(
      workDir,
      "target",
      "wasm32-unknown-unknown",
      "release",
      "lumens_block_generated.wasm"
    )

    const wasmBuffer = await readFile(wasmPath)
    const sourceHash = createHash("sha256").update(generated.source).digest("hex").slice(0, 16)

    return {
      ok: true,
      data: {
        wasm: wasmBuffer.toString("base64"),
        sourceHash,
        sizeBytes: wasmBuffer.length,
      },
    }
  } catch (err) {
    const message = formatCompileFailure(err)
    return {
      ok: false,
      error: compileError("COMPILATION_FAILED", message),
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

function formatCompileFailure(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr?: string }).stderr ?? "")
    const stdout = String((err as { stdout?: string }).stdout ?? "")
    const combined = `${stderr}\n${stdout}`.trim()

    if (combined.includes("no such command") || combined.includes("not found")) {
      return "Rust toolchain not available. Install Rust and the wasm32-unknown-unknown target."
    }

    const rustcError = combined.match(/error\[E\d+\]:[^\n]+/g)
    if (rustcError?.length) {
      return `Contract compilation failed: ${rustcError[0]}`
    }

    if (combined.length > 0) {
      const lastLines = combined.split("\n").slice(-5).join("\n")
      return `Contract compilation failed:\n${lastLines}`
    }
  }

  if (err instanceof Error) {
    if (err.message.includes("ENOENT")) {
      return "Rust toolchain not available. Install Rust and run: rustup target add wasm32-unknown-unknown"
    }
    return err.message
  }

  return "Unknown compilation error."
}

/**
 * Checks whether the Rust/WASM toolchain is available on the host.
 */
export async function isToolchainAvailable(cargoPath = "cargo"): Promise<boolean> {
  try {
    await execFileAsync(cargoPath, ["--version"], { timeout: 5_000 })
    return true
  } catch {
    return false
  }
}
