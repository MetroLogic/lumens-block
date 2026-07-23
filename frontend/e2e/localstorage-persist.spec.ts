import { test, expect } from "@playwright/test"

/**
 * Test: Graph is saved to localStorage on change and restored on reload.
 *
 * Steps:
 * 1. Navigate to /editor and add a Transfer block.
 * 2. Wait for the localStorage key "lumens-block-graph" to be written
 *    (BlockEditor writes it in a useEffect on every nodes/edges change).
 * 3. Reload the page.
 * 4. Confirm the Transfer node is still present — it was restored from storage.
 */
test("graph is saved to localStorage and restored on reload", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  await expect(toolbar).toBeVisible()

  // Add a Transfer block
  const transferItem = page.locator('[data-testid="toolbar-block-transfer"]')
  await transferItem.focus()
  await transferItem.press("Enter")
  await page.waitForTimeout(400)

  // Confirm the Transfer node is visible before reload
  const transferNode = page.locator('[data-testid="block-node-Transfer"]')
  await expect(transferNode).toBeVisible()

  // Wait until localStorage has been written
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("lumens-block:graph")
    if (!raw) return false
    try {
      const graph = JSON.parse(raw) as { nodes: unknown[] }
      return Array.isArray(graph.nodes) && graph.nodes.length > 1
    } catch {
      return false
    }
  }, undefined, { timeout: 5_000 })

  // Reload — the page should restore state from localStorage
  await page.reload()
  await page.waitForTimeout(500)

  // The Transfer node should still be present
  await expect(page.locator('[data-testid="block-node-Transfer"]')).toBeVisible()
})
