import { test, expect } from "@playwright/test"

/**
 * E2E tests for Undo / Redo history functionality:
 * 1. Drags a block, presses Ctrl+Z, and asserts the block is removed from the canvas.
 * 2. Verifies toolbar Undo/Redo buttons disabled/enabled state and click behavior.
 * 3. Verifies redo via shortcut restores the block.
 */
test.describe("Editor undo/redo history", () => {
  test("drags a block, presses Ctrl+Z, and asserts the block is removed from the canvas", async ({ page }) => {
    await page.goto("/editor")

    const toolbar = page.locator('[data-testid="toolbar"]')
    const canvas = page.locator('[data-testid="editor-canvas"]')
    await expect(toolbar).toBeVisible()
    await expect(canvas).toBeVisible()

    // Count existing React Flow nodes before the drag
    const nodesBefore = await page.locator(".react-flow__node").count()

    // Grab the "Transfer" block from the toolbar
    const transferBlock = page.locator('[data-testid="toolbar-block-transfer"]')
    await expect(transferBlock).toBeVisible()

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

    // Assert the block was added
    const nodesAfterDrag = await page.locator(".react-flow__node").count()
    expect(nodesAfterDrag).toBe(nodesBefore + 1)

    // Press Ctrl+Z to undo
    await page.keyboard.press("Control+z")
    await page.waitForTimeout(300)

    // Assert the block is removed from the canvas
    const nodesAfterUndo = await page.locator(".react-flow__node").count()
    expect(nodesAfterUndo).toBe(nodesBefore)
  })

  test("toolbar undo and redo buttons toggle disabled state and trigger undo/redo", async ({ page }) => {
    await page.goto("/editor")

    const undoButton = page.locator('[data-testid="toolbar-undo"]')
    const redoButton = page.locator('[data-testid="toolbar-redo"]')
    await expect(undoButton).toBeVisible()
    await expect(redoButton).toBeVisible()

    // Initially, both undo and redo should be disabled
    await expect(undoButton).toBeDisabled()
    await expect(redoButton).toBeDisabled()

    const nodesBefore = await page.locator(".react-flow__node").count()

    // Add a condition block via keyboard Enter on toolbar
    const conditionBlock = page.locator('[data-testid="toolbar-block-condition"]')
    await conditionBlock.focus()
    await conditionBlock.press("Enter")
    await page.waitForTimeout(300)

    // A node was added -> undo should be enabled, redo disabled
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore + 1)
    await expect(undoButton).toBeEnabled()
    await expect(redoButton).toBeDisabled()

    // Click undo button
    await undoButton.click()
    await page.waitForTimeout(300)

    // Canvas reverted -> undo disabled, redo enabled
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore)
    await expect(undoButton).toBeDisabled()
    await expect(redoButton).toBeEnabled()

    // Click redo button
    await redoButton.click()
    await page.waitForTimeout(300)

    // Block restored -> undo enabled, redo disabled
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore + 1)
    await expect(undoButton).toBeEnabled()
    await expect(redoButton).toBeDisabled()
  })

  test("Ctrl+Y redoes the undone action", async ({ page }) => {
    await page.goto("/editor")

    const nodesBefore = await page.locator(".react-flow__node").count()

    // Add an Event block
    const eventBlock = page.locator('[data-testid="toolbar-block-event"]')
    await eventBlock.focus()
    await eventBlock.press("Enter")
    await page.waitForTimeout(300)

    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore + 1)

    // Undo via keyboard
    await page.keyboard.press("Control+z")
    await page.waitForTimeout(300)
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore)

    // Redo via Ctrl+Y
    await page.keyboard.press("Control+y")
    await page.waitForTimeout(300)
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore + 1)
  })
})

