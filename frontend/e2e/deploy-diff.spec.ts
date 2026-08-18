import { test, expect } from "@playwright/test"

/**
 * Test: The deploy flow diffs the canvas against the last-deployed snapshot
 * and gates redeployment behind a REDEPLOY confirmation when breaking changes
 * are detected.
 *
 * A real deploy requires a Freighter wallet, which isn't available in CI, so we
 * seed localStorage directly — the same keys `saveDeployedSnapshot` /
 * `saveGraphToStorage` would have written after a successful deployment — and
 * verify the UI flow around them.
 */

const deployedGraph = {
  nodes: [
    { id: "1", type: "default", position: { x: 250, y: 50 }, data: { label: "Start" } },
    {
      id: "2",
      type: "Storage",
      position: { x: 250, y: 150 },
      data: { label: "Save Value", params: { storageKey: "foo" } },
    },
  ],
  edges: [{ id: "e1-2", source: "1", target: "2" }],
}

const modifiedGraph = {
  nodes: [
    { id: "1", type: "default", position: { x: 250, y: 50 }, data: { label: "Start" } },
    {
      id: "2",
      type: "Storage",
      position: { x: 250, y: 150 },
      data: { label: "Save Value", params: { storageKey: "bar" } },
    },
  ],
  edges: [{ id: "e1-2", source: "1", target: "2" }],
}

test.describe("Deploy breaking-change gate", () => {
  test("shows the breaking-change modal with storage_key_renamed when a Storage key changed", async ({
    page,
  }) => {
    // Simulate a previous successful deploy of `deployedGraph` and a canvas
    // that has since diverged (storage key foo → bar).
    await page.addInitScript(
      ({ deployed, modified }) => {
        localStorage.setItem("lumens-block:deployedGraph", JSON.stringify(deployed))
        localStorage.setItem("lumens-block:graph", JSON.stringify(modified))
      },
      { deployed: deployedGraph, modified: modifiedGraph }
    )

    await page.goto("/editor")
    await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()
    // Wait for the canvas to hydrate from localStorage before interacting.
    await expect(page.locator('[data-testid="block-node-Storage"]')).toBeVisible()

    // Clicking Deploy must open the breaking-change modal instead of
    // proceeding directly to the confirmation modal.
    await page.locator('[data-testid="deploy-button"]').click()

    const modal = page.locator('[data-testid="breaking-change-modal"]')
    await expect(modal).toBeVisible()

    // The storage_key_renamed change is listed with a human-readable message.
    const items = page.locator('[data-testid="breaking-change-item"]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Storage key "foo" was renamed to "bar"')

    // The redeploy button stays disabled until the exact word REDEPLOY is typed.
    const confirmButton = page.locator('[data-testid="redeploy-confirm-button"]')
    const input = page.locator('[data-testid="redeploy-confirm-input"]')
    await expect(confirmButton).toBeDisabled()

    await input.fill("REDEPLOYMENT")
    await expect(confirmButton).toBeDisabled()

    await input.fill("REDEPLOY")
    await expect(confirmButton).toBeEnabled()

    // Confirming proceeds to the standard deployment confirmation modal.
    await confirmButton.click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByRole("heading", { name: "Confirm deployment" })).toBeVisible()
  })

  test("first deployment (no snapshot) skips the diff modal entirely", async ({ page }) => {
    // Only the canvas graph exists — no deployed snapshot was ever saved.
    await page.addInitScript(
      ({ modified }) => {
        localStorage.setItem("lumens-block:graph", JSON.stringify(modified))
      },
      { modified: modifiedGraph }
    )

    await page.goto("/editor")
    await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()
    await expect(page.locator('[data-testid="block-node-Storage"]')).toBeVisible()

    await page.locator('[data-testid="deploy-button"]').click()

    await expect(page.locator('[data-testid="breaking-change-modal"]')).not.toBeVisible()
    await expect(page.getByRole("heading", { name: "Confirm deployment" })).toBeVisible()
  })

  test("non-breaking changes show an informational notice without blocking", async ({ page }) => {
    const snapshot = {
      nodes: [
        { id: "1", type: "default", position: { x: 250, y: 50 }, data: { label: "Start" } },
        { id: "2", type: "Auth", position: { x: 250, y: 150 }, data: { label: "Auth Check" } },
      ],
      edges: [{ id: "e1-2", source: "1", target: "2" }],
    }
    const withAddedStorage = {
      nodes: [
        ...snapshot.nodes,
        {
          id: "3",
          type: "Storage",
          position: { x: 250, y: 250 },
          data: { label: "Save Value", params: { storageKey: "balance" } },
        },
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2" },
        { id: "e2-3", source: "2", target: "3" },
      ],
    }

    await page.addInitScript(
      ({ snapshot: snap, graph }) => {
        localStorage.setItem("lumens-block:deployedGraph", JSON.stringify(snap))
        localStorage.setItem("lumens-block:graph", JSON.stringify(graph))
      },
      { snapshot, graph: withAddedStorage }
    )

    await page.goto("/editor")
    await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()
    await expect(page.locator('[data-testid="block-node-Auth"]')).toBeVisible()
    await expect(page.locator('[data-testid="block-node-Storage"]')).toBeVisible()

    await page.locator('[data-testid="deploy-button"]').click()

    await expect(page.locator('[data-testid="breaking-change-modal"]')).not.toBeVisible()
    await expect(page.getByRole("heading", { name: "Confirm deployment" })).toBeVisible()
    const notice = page.locator('[data-testid="non-breaking-notice"]')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText("1 block(s) added")
  })
})
