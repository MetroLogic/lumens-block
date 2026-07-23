import { test, expect } from "@playwright/test"

/**
 * Test: Clicking a Condition node opens its config panel.
 *
 * BlockNode renders a `data-testid="config-panel"` section below the node
 * header only when the node is *selected* AND its type is "Condition".
 *
 * Steps:
 * 1. Add a Condition block via keyboard shortcut.
 * 2. Click the node to select it.
 * 3. Assert the config panel becomes visible.
 */
test("clicking a Condition node opens the config panel", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  await expect(toolbar).toBeVisible()

  // Add a Condition block via Enter key
  const conditionItem = page.locator('[data-testid="toolbar-block-condition"]')
  await conditionItem.focus()
  await conditionItem.press("Enter")
  await page.waitForTimeout(300)

  // The new Condition node should be on the canvas
  const conditionNode = page.locator('[data-testid="block-node-Condition"]')
  await expect(conditionNode).toBeVisible()

  // Config panel should NOT be visible before selection
  const configPanel = page.locator('[data-testid="config-panel"]')
  await expect(configPanel).not.toBeVisible()

  // Click the node to select it
  await conditionNode.click()
  await page.waitForTimeout(200)

  // Config panel should now be visible
  await expect(configPanel).toBeVisible()
})
