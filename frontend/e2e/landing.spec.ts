import { test, expect } from "@playwright/test"

/**
 * Test: Landing page loads and "Open Editor" navigates to /editor
 *
 * Verifies:
 * - The landing page renders without error
 * - At least one "Open Editor" link is visible
 * - Clicking it navigates to the /editor route
 * - The editor canvas mounts on /editor
 */
test("landing page loads and Open Editor navigates to /editor", async ({ page }) => {
  await page.goto("/")

  // The page title should include "LumensBlock"
  await expect(page).toHaveTitle(/LumensBlock/)

  // There can be multiple "Open Editor" links (nav + hero CTA); click the first one
  const openEditorLinks = page.getByRole("link", { name: /open editor/i })
  await expect(openEditorLinks.first()).toBeVisible()
  await openEditorLinks.first().click()

  // Should land on /editor
  await expect(page).toHaveURL(/\/editor/)

  // The editor canvas should mount
  await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()
})
