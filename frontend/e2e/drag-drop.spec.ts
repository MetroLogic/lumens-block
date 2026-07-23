import { test, expect } from "@playwright/test"

/**
 * Test: A block can be dragged from the toolbar and dropped on the canvas.
 *
 * React Flow handles the drop via `onDrop` / `onDragOver` events wired to the
 * canvas wrapper.  Playwright's dragTo() dispatches the full drag sequence
 * including dataTransfer, which is what BlockEditor.onDrop reads.
 *
 * We count nodes before and after the drag to confirm a new node was added.
 */
test("drag a block from the toolbar and drop it on the canvas", async ({ page }) => {
  await page.goto("/editor")

  // Wait for the toolbar and canvas to be ready
  const toolbar = page.locator('[data-testid="toolbar"]')
  const canvas = page.locator('[data-testid="editor-canvas"]')
  await expect(toolbar).toBeVisible()
  await expect(canvas).toBeVisible()

  // Count existing React Flow nodes before the drag
  const nodesBefore = await page.locator(".react-flow__node").count()

  // Grab the "Transfer" block from the toolbar
  const transferBlock = page.locator('[data-testid="toolbar-block-transfer"]')
  await expect(transferBlock).toBeVisible()

  // Get the bounding box of the canvas to compute a drop target in the centre
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  const dropX = canvasBox!.x + canvasBox!.width / 2
  const dropY = canvasBox!.y + canvasBox!.height / 2

  // Perform the drag: set dataTransfer so BlockEditor.onDrop receives the type
  await transferBlock.dispatchEvent("dragstart", {
    dataTransfer: { setData: () => undefined, dropEffect: "move" },
  })

  // Use dragTo with a target position
  await transferBlock.dragTo(canvas, {
    targetPosition: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 },
  })

  // Give React a moment to reconcile
  await page.waitForTimeout(300)

  // There should be one more node on the canvas
  const nodesAfter = await page.locator(".react-flow__node").count()
  expect(nodesAfter).toBeGreaterThan(nodesBefore)
})
