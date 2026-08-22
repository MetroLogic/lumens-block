import { test, expect } from "@playwright/test"

/**
 * Test: connecting an incompatible Condition operand highlights the edge
 * feeding that Condition node in red, and fixing the mismatch removes it.
 *
 * Strategy:
 * 1. Build Start → Transfer → Condition (Transfer brings `caller`/`amount`
 *    into scope for the Condition's operand pickers).
 * 2. Configure the Condition to compare `caller` (Address) with `amount`
 *    (i128) using the numeric ">" operator — invalid Rust.
 * 3. Assert the Transfer → Condition edge gets the red "type-mismatch-edge"
 *    styling.
 * 4. Change the left operand to `amount` (i128 > i128 is valid) and assert
 *    the red styling is removed.
 */
test("mismatched Condition operands highlight the edge red, and fixing them clears it", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  await expect(toolbar).toBeVisible()

  const transferItem = page.locator('[data-testid="toolbar-block-transfer"]')
  await transferItem.focus()
  await transferItem.press("Enter")
  await page.waitForTimeout(200)

  const conditionItem = page.locator('[data-testid="toolbar-block-condition"]')
  await conditionItem.focus()
  await conditionItem.press("Enter")
  await page.waitForTimeout(200)

  const nodes = page.locator(".react-flow__node")
  await expect(nodes).toHaveCount(3, { timeout: 5_000 })

  const startNode = nodes.nth(0)
  const transferNode = nodes.nth(1)
  const conditionNode = nodes.nth(2)

  await startNode.locator(".react-flow__handle-bottom").dragTo(transferNode.locator(".react-flow__handle-top"))
  await page.waitForTimeout(200)
  await transferNode.locator(".react-flow__handle-bottom").dragTo(conditionNode.locator(".react-flow__handle-top"))
  await page.waitForTimeout(200)

  await expect(page.locator(".react-flow__edge")).toHaveCount(2, { timeout: 5_000 })

  // Open the Condition config panel and wire up an invalid comparison.
  await conditionNode.click()
  const configPanel = page.locator('[data-testid="config-panel"]')
  await expect(configPanel).toBeVisible()

  await page.selectOption("#condition-left-value", "caller")
  await page.selectOption("#condition-operator", ">")
  await page.selectOption("#condition-right-value", "amount")

  const mismatchedEdge = page.locator(".react-flow__edge.type-mismatch-edge")
  await expect(mismatchedEdge).toHaveCount(1, { timeout: 5_000 })

  // Hovering the red edge shows the mismatch tooltip.
  await mismatchedEdge.hover()
  const tooltip = page.locator('[data-testid="edge-type-error-tooltip"]')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText("non-numeric")

  // Fix it: comparing two i128 operands is valid.
  await page.selectOption("#condition-left-value", "amount")

  await expect(page.locator(".react-flow__edge.type-mismatch-edge")).toHaveCount(0, { timeout: 5_000 })
})
