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

  // Perform HTML5 drag and drop with a real DataTransfer payload
  await page.evaluate(
    ({ sourceId, targetId, blockType }) => {
      const source = document.querySelector(`[data-testid="${sourceId}"]`)
      const target = document.querySelector(`[data-testid="${targetId}"]`)
      if (!source || !target) return

      const dataTransfer = new DataTransfer()
      dataTransfer.setData("application/blocktype", blockType)

      const dragStartEvent = new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
      source.dispatchEvent(dragStartEvent)

      const targetRect = target.getBoundingClientRect()
      const clientX = targetRect.left + targetRect.width / 2
      const clientY = targetRect.top + targetRect.height / 2

      const dragOverEvent = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      })
      target.dispatchEvent(dragOverEvent)

      const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      })
      target.dispatchEvent(dropEvent)
    },
    {
      sourceId: "toolbar-block-transfer",
      targetId: "editor-canvas",
      blockType: "Transfer",
    }
  )

  // Give React a moment to reconcile
  await page.waitForTimeout(300)

  // There should be one more node on the canvas
  const nodesAfter = await page.locator(".react-flow__node").count()
  expect(nodesAfter).toBeGreaterThan(nodesBefore)
})
