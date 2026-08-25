import { test, expect, type Page } from "@playwright/test"

/**
 * Loop block E2E: drag a Loop onto the canvas, configure it, connect a body
 * block, and assert the code preview emits a bounded `for __i in` loop.
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

async function zoomOut(page: Page, times = 4) {
  const button = page.locator(".react-flow__controls-zoomout")
  await expect(button).toBeVisible()
  for (let i = 0; i < times; i++) {
    await button.click()
    await page.waitForTimeout(80)
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("lumens-block:graph"))
})

test("drag a Loop block, configure it, connect a body, and preview bounded for __i in", async ({
  page,
}) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  const canvas = page.locator('[data-testid="editor-canvas"]')
  await expect(toolbar).toBeVisible()
  await expect(canvas).toBeVisible()

  const toolbarLoop = page.locator('[data-testid="toolbar-block-loop"]')
  await expect(toolbarLoop).toBeVisible()

  await zoomOut(page)

  await dropBlock(page, "Loop", { x: 520, y: 280 })
  await dropBlock(page, "Transfer", { x: 820, y: 280 })

  const loopNode = page.locator('[data-testid="block-node-Loop"]')
  const transferNode = page.locator('[data-testid="block-node-Transfer"]')
  const startNode = page.locator('[data-testid="block-node-default"]')
  await expect(loopNode).toBeVisible()
  await expect(transferNode).toBeVisible()

  // items: Start → Loop (top handle)
  const startSource = startNode.locator(".react-flow__handle-bottom")
  const loopItems = loopNode.locator(".react-flow__handle-top")
  await expect(startSource).toBeVisible()
  await expect(loopItems).toBeVisible()
  await startSource.dragTo(loopItems)
  await page.waitForTimeout(200)

  // body: Loop (right handle) → Transfer
  const loopBody = loopNode.locator(".react-flow__handle-right")
  const transferTarget = transferNode.locator(".react-flow__handle-top")
  await expect(loopBody).toBeVisible()
  await expect(transferTarget).toBeVisible()
  await loopBody.dragTo(transferTarget)
  await page.waitForTimeout(200)

  // Configure the Loop via the side-of-node config panel
  await loopNode.click({ position: { x: 30, y: 12 } })
  const panel = page.locator('[data-testid="config-panel"]')
  await expect(panel).toBeVisible()
  await expect(panel.getByText("Loop Config")).toBeVisible()
  await expect(panel.getByTestId("loop-mode-range")).toBeVisible()
  await expect(panel.getByTestId("loop-max-iterations")).toBeVisible()
  await expect(panel.getByTestId("loop-iterator-var")).toBeVisible()

  await panel.getByTestId("loop-max-iterations").fill("10")
  await panel.getByTestId("loop-iterator-var").fill("i")
  await page.waitForTimeout(150)

  await page.getByRole("button", { name: "Code Preview" }).click()

  const preview = page.locator("pre")
  await expect(preview).toBeVisible()
  const code = (await preview.innerText()).replace(/\n\s*\d+\s*/g, "\n")

  expect(code).toContain("for __i in")
  expect(code).toContain(".min(")
})
