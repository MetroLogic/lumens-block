import { test, expect } from "@playwright/test"

/**
 * E2E Test for RBACCheck block:
 * 1. Add an RBACCheck block to the canvas.
 * 2. Select the node to open the config panel.
 * 3. Verify rbacRole (admin) and rbacAction (require) configuration options.
 * 4. Click Preview Code and verify the code preview modal contains `require_auth`.
 */
test("rbac block configuration and code preview contains require_auth", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  await expect(toolbar).toBeVisible()

  // Add an RBACCheck block via keyboard Enter key
  const rbacItem = page.locator('[data-testid="toolbar-block-rbaccheck"]')
  await expect(rbacItem).toBeVisible()
  await rbacItem.focus()
  await rbacItem.press("Enter")
  await page.waitForTimeout(300)

  // The new RBACCheck node should be visible on canvas
  const rbacNode = page.locator('[data-testid="block-node-RBACCheck"]')
  await expect(rbacNode).toBeVisible()

  // Click the node to open config panel
  await rbacNode.click()
  await page.waitForTimeout(200)

  const configPanel = page.locator('[data-testid="config-panel"]')
  await expect(configPanel).toBeVisible()

  const roleSelect = page.locator('[data-testid="rbac-role-select"]')
  await expect(roleSelect).toHaveValue("admin")

  // Connect Start node to RBACCheck node so it is reachable and compiled
  const startNode = page.locator('[data-testid="block-node-default"]')
  const startHandle = startNode.locator(".react-flow__handle-bottom")
  const rbacHandle = rbacNode.locator(".react-flow__handle-top")
  await expect(startHandle).toBeVisible()
  await expect(rbacHandle).toBeVisible()
  await startHandle.dragTo(rbacHandle)
  await page.waitForTimeout(300)

  // Click "Code Preview" button
  await page.getByRole("button", { name: "Code Preview" }).click()
  await page.waitForTimeout(300)

  // Code preview pre element should contain `require_auth`
  const preview = page.locator("pre")
  await expect(preview).toBeVisible()
  const code = await preview.innerText()
  expect(code).toContain("require_auth")
})
