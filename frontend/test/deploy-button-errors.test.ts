import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("DeployButton deployment error handling", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/editor/DeployButton.tsx"),
    "utf8"
  )

  it("captures and logs raw deployment errors", () => {
    expect(source).toContain("catch (err)")
    expect(source).toContain('console.error("Deployment failed", err)')
    expect(source).not.toContain("} catch {\n      setStatus(\"error\")")
  })

  it("maps common deployment failures to user-facing guidance", () => {
    expect(source).toContain("function getDeploymentErrorMessage(err: unknown): string")
    expect(source).toContain("Freighter wallet is not installed or unavailable")
    expect(source).toContain("Deployment was cancelled in Freighter")
    expect(source).toContain("Insufficient XLM balance")
    expect(source).toContain("https://laboratory.stellar.org/")
    expect(source).toContain("Network or Stellar RPC request failed")
    expect(source).toContain("Deployment failed. Check the console for details.")
  })

  it("renders a dismissible alert for deployment failures", () => {
    expect(source).toContain('role={status === "error" ? "alert" : "status"}')
    expect(source).toContain('onClick={() => setMessage(null)}')
    expect(source).toContain("Dismiss")
  })
})