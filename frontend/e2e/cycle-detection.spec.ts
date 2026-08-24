import { test, expect, type Page } from "@playwright/test"

/**
 * Test: connecting two nodes in both directions forms a cycle that the
 * compiler rejects, with a visible error and highlighted nodes.
 *
 * Blocks are dropped at chosen coordinates (same technique as
 * function-groups.spec.ts) so handle drags are not fighting stacked nodes.
 */

async function dropBlock(
  page: Page,
  blockType: string,
  point: { x: number; y: number }
): Promise<void> {
  await page.evaluate(
    ({ sourceId, blockType, x, y }) => {
      const source = document.querySelector(`[data-testid="${sourceId}"]`)
      const target = document.querySelector('[data-testid="editor-canvas"]')
      if (!source || !target) throw new Error(`Missing ${sourceId} or canvas`)

      const dataTransfer = new DataTransfer()
      dataTransfer.setData("application/blocktype", blockType)

      source.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer })
      )
      for (const type of ["dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer,
          })
        )
      }
    },
    { sourceId: `toolbar-block-${blockType.toLowerCase()}`, blockType, x: point.x, y: point.y }
  )
  await page.waitForTimeout(200)
}

async function connect(page: Page, from: string, to: string) {
  const source = page.locator(from).locator(".react-flow__handle-bottom")
  const target = page.locator(to).locator(".react-flow__handle-top")
  await expect(source).toBeVisible()
  await expect(target).toBeVisible()
  await source.dragTo(target)
  await page.waitForTimeout(200)
}

async function zoomOut(page: Page, times = 4) {
  const button = page.locator(".react-flow__controls-zoomout")
  await expect(button).toBeVisible()
  for (let i = 0; i < times; i++) {
    await button.click()
    await page.waitForTimeout(80)
  }
}

test("a two-node cycle is rejected with a message and highlighted nodes", async ({ page }) => {
  // Clear restored graphs before navigation so this spec starts from a blank canvas.
  await page.addInitScript(() => window.localStorage.removeItem("lumens-block:graph"))
  await page.goto("/editor")

  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
  await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()

  await zoomOut(page)

  const canvas = page.locator('[data-testid="editor-canvas"]')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const originX = box!.x + 420
  const originY = box!.y + 180

  await dropBlock(page, "Transfer", { x: originX, y: originY })
  await dropBlock(page, "Storage", { x: originX, y: originY + 220 })

  const transferNode = page.locator('[data-testid="block-node-Transfer"]')
  const storageNode = page.locator('[data-testid="block-node-Storage"]')
  await expect(transferNode).toBeVisible()
  await expect(storageNode).toBeVisible()

  await connect(page, '[data-testid="block-node-Transfer"]', '[data-testid="block-node-Storage"]')
  await connect(page, '[data-testid="block-node-Storage"]', '[data-testid="block-node-Transfer"]')

  const banner = page.locator('[data-testid="cycle-error-banner"]')
  await expect(banner).toBeVisible({ timeout: 5_000 })
  await expect(banner).toContainText("Cycle detected")
  await expect(banner).toContainText(/Transfer/)
  await expect(banner).toContainText(/Storage/)

  await expect(transferNode).toHaveAttribute("data-error", "cycle")
  await expect(storageNode).toHaveAttribute("data-error", "cycle")
  await expect(page.locator(".cycle-error-node")).toHaveCount(2)

  await page.locator('[data-testid="code-preview-button"]').click()
  const compileError = page.locator('[data-testid="compile-error"]')
  await expect(compileError).toBeVisible({ timeout: 5_000 })
  await expect(compileError).toContainText("Cycle detected")
})
