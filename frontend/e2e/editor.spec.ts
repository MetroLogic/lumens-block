import { expect, test, type Page } from "@playwright/test"

async function openFreshEditor(page: Page) {
  await page.goto("/editor")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByTestId("editor-canvas")).toBeVisible()
  await expect(page.locator(".react-flow__node", { hasText: "Start" })).toBeVisible()
}

async function dragBlockToCanvas(page: Page, blockType: string, targetPosition = { x: 520, y: 320 }) {
  await page.getByTestId(`block-${blockType.toLowerCase()}`).dragTo(page.getByTestId("editor-canvas"), {
    targetPosition,
  })
}

async function connectHandles(page: Page, sourceTestId: string, targetTestId: string) {
  const sourceBox = await page.getByTestId(sourceTestId).boundingBox()
  const targetBox = await page.getByTestId(targetTestId).boundingBox()

  if (!sourceBox || !targetBox) {
    throw new Error("Unable to locate connection handles")
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()
}

test("landing page opens the editor", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Build Stellar Smart Contracts/i })).toBeVisible()

  await page.getByRole("link", { name: /Open Editor/i }).first().click()

  await expect(page).toHaveURL(/\/editor$/)
  await expect(page.getByTestId("editor-canvas")).toBeVisible()
  await expect(page.locator(".react-flow__node", { hasText: "Start" })).toBeVisible()
})

test("a toolbar block can be dragged onto the canvas", async ({ page }) => {
  await openFreshEditor(page)

  await dragBlockToCanvas(page, "Transfer")

  await expect(page.locator(".react-flow__node", { hasText: "Transfer" })).toBeVisible()
})

test("two nodes can be connected by dragging between handles", async ({ page }) => {
  await openFreshEditor(page)
  await dragBlockToCanvas(page, "Transfer", { x: 720, y: 430 })

  await connectHandles(page, "node-start-source", "node-transfer-target")

  await expect(page.locator(".react-flow__edge")).toHaveCount(1)
})

test("clicking a node opens the configuration panel", async ({ page }) => {
  await openFreshEditor(page)

  await page.locator(".react-flow__node", { hasText: "Start" }).click()

  await expect(page.getByTestId("node-config-panel")).toBeVisible()
  await expect(page.getByTestId("node-config-panel")).toContainText("Configure Block")
  await expect(page.getByLabel("Node label")).toHaveValue("Start")
})

test("graph changes save to localStorage and restore after reload", async ({ page }) => {
  await openFreshEditor(page)
  await dragBlockToCanvas(page, "Storage")
  await page.locator(".react-flow__node", { hasText: "Storage" }).click()
  await page.getByLabel("Node label").fill("Stored Balance")

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("lumens-block:editor-graph")
        if (!raw) return false
        const graph = JSON.parse(raw) as { nodes?: Array<{ data?: { label?: string } }> }
        return graph.nodes?.some((node) => node.data?.label === "Stored Balance") ?? false
      })
    )
    .toBe(true)

  await page.reload()

  await expect(page.locator(".react-flow__node", { hasText: "Stored Balance" })).toBeVisible()
})
