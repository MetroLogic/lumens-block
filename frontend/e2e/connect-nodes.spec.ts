import { test, expect } from "@playwright/test"

/**
 * Test: Two nodes can be connected by dragging between their handles.
 *
 * Strategy:
 * 1. Add two blocks via the keyboard shortcut path (Enter on toolbar items)
 *    so we have predictable nodes without relying on drag-drop positioning.
 * 2. Locate the source handle of the first node and the target handle of
 *    the second node.
 * 3. Drag from source → target.
 * 4. Assert that a React Flow edge element appears in the DOM.
 */
test("two nodes can be connected by dragging between handles", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  await expect(toolbar).toBeVisible()

  // Add a Transfer block via keyboard (avoids coordinate-sensitive drag)
  const transferItem = page.locator('[data-testid="toolbar-block-transfer"]')
  await transferItem.focus()
  await transferItem.press("Enter")
  await page.waitForTimeout(200)

  // Add a Storage block
  const storageItem = page.locator('[data-testid="toolbar-block-storage"]')
  await storageItem.focus()
  await storageItem.press("Enter")
  await page.waitForTimeout(200)

  // We now expect at least 3 nodes: the initial "Start" node + Transfer + Storage
  const nodes = page.locator(".react-flow__node")
  await expect(nodes).toHaveCount(3, { timeout: 5_000 })

  // Count edges before connecting
  const edgesBefore = await page.locator(".react-flow__edge").count()

  // Grab the source handle (bottom) of the second node and
  // the target handle (top) of the third node.
  const secondNode = nodes.nth(1)
  const thirdNode = nodes.nth(2)

  const sourceHandle = secondNode.locator(".react-flow__handle-bottom")
  const targetHandle = thirdNode.locator(".react-flow__handle-top")

  await expect(sourceHandle).toBeVisible()
  await expect(targetHandle).toBeVisible()

  // Drag from source handle to target handle to create a connection
  await sourceHandle.dragTo(targetHandle)
  await page.waitForTimeout(300)

  // An edge should now exist
  const edgesAfter = await page.locator(".react-flow__edge").count()
  expect(edgesAfter).toBeGreaterThan(edgesBefore)
})
