import { test, expect, type Page } from "@playwright/test"

/**
 * Test: a graph with two named function entry points compiles to two `pub fn`
 * blocks, and the code preview shows both.
 *
 * The blocks are dropped with a synthetic HTML5 drag (the same technique
 * drag-drop.spec.ts uses) so each node lands at a coordinate we chose — the
 * keyboard-add path stacks nodes at computed offsets, which makes the handle
 * drags below unreliable.
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

/** Drags from one node's bottom handle to another node's top handle. */
async function connect(page: Page, from: string, to: string) {
  const source = page.locator(from).locator(".react-flow__handle-bottom")
  const target = page.locator(to).locator(".react-flow__handle-top")
  await expect(source).toBeVisible()
  await expect(target).toBeVisible()
  await source.dragTo(target)
  await page.waitForTimeout(200)
}

/**
 * Selects a node by clicking its header.
 *
 * Clicking the node's centre is unreliable once a config panel has expanded it:
 * the centre lands inside the panel, which React Flow treats as a child, not the
 * node. The header is always at the top of the node.
 */
async function selectNode(page: Page, node: string) {
  await page.locator(node).click({ position: { x: 30, y: 12 } })
  await page.waitForTimeout(150)
}

/** Selects a node and types a function name into its config panel. */
async function nameFunction(page: Page, node: string, name: string) {
  await selectNode(page, node)
  const panel = page.locator('[data-testid="function-entry-panel"]')
  await expect(panel).toBeVisible()
  await panel.locator('[data-testid="function-name-input"]').fill(name)
  await page.waitForTimeout(150)
}

/** Selects a FunctionReturn node and sets its return type. */
async function setReturnType(page: Page, node: string, rustType: string) {
  await selectNode(page, node)
  const panel = page.locator('[data-testid="function-return-panel"]')
  await expect(panel).toBeVisible()
  await panel.locator('[data-testid="function-return-type-input"]').fill(rustType)
  await page.waitForTimeout(150)
}

/**
 * Zooms the canvas out before dropping blocks.
 *
 * React Flow's `fitView` zooms all the way in on the single Start node, so a
 * comfortable-looking gap in screen pixels becomes a few flow units and the
 * dropped nodes overlap — which puts one node's handle on top of the next one's.
 */
async function zoomOut(page: Page, times = 4) {
  const button = page.locator(".react-flow__controls-zoomout")
  await expect(button).toBeVisible()
  for (let i = 0; i < times; i++) {
    await button.click()
    await page.waitForTimeout(80)
  }
}

test.beforeEach(async ({ page }) => {
  // Start from a clean canvas: the editor restores the previous graph otherwise.
  await page.addInitScript(() => window.localStorage.removeItem("lumens-block:graph"))
})

test("two FunctionEntry blocks compile to two pub fn blocks in the code preview", async ({
  page,
}) => {
  await page.goto("/editor")
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
  await expect(page.locator('[data-testid="editor-canvas"]')).toBeVisible()
  await zoomOut(page)

  // ── deposit: FunctionEntry → Auth → FunctionReturn ────────────────────────
  await dropBlock(page, "FunctionEntry", { x: 420, y: 130 })
  await dropBlock(page, "Auth", { x: 420, y: 330 })
  await dropBlock(page, "FunctionReturn", { x: 420, y: 530 })

  // ── withdraw: FunctionEntry → Storage → FunctionReturn ────────────────────
  await dropBlock(page, "FunctionEntry", { x: 900, y: 130 })
  await dropBlock(page, "Storage", { x: 900, y: 330 })
  await dropBlock(page, "FunctionReturn", { x: 900, y: 530 })

  const entries = page.locator('[data-testid="block-node-FunctionEntry"]')
  const returns = page.locator('[data-testid="block-node-FunctionReturn"]')
  await expect(entries).toHaveCount(2)
  await expect(returns).toHaveCount(2)

  await connect(page, '[data-testid="block-node-FunctionEntry"] >> nth=0', '[data-testid="block-node-Auth"]')
  await connect(page, '[data-testid="block-node-Auth"]', '[data-testid="block-node-FunctionReturn"] >> nth=0')
  await connect(page, '[data-testid="block-node-FunctionEntry"] >> nth=1', '[data-testid="block-node-Storage"]')
  await connect(page, '[data-testid="block-node-Storage"]', '[data-testid="block-node-FunctionReturn"] >> nth=1')

  await expect(page.locator(".react-flow__edge")).toHaveCount(4)

  await nameFunction(page, '[data-testid="block-node-FunctionEntry"] >> nth=0', "deposit")
  await nameFunction(page, '[data-testid="block-node-FunctionEntry"] >> nth=1', "withdraw")
  await setReturnType(page, '[data-testid="block-node-FunctionReturn"] >> nth=0', "i128")
  await setReturnType(page, '[data-testid="block-node-FunctionReturn"] >> nth=1', "bool")

  // ── the payoff: both functions in one generated impl block ────────────────
  await page.getByRole("button", { name: "Code Preview" }).click()

  const preview = page.locator("pre")
  await expect(preview).toBeVisible()
  const code = (await preview.innerText()).replace(/\n\s*\d+\s*/g, "\n")

  expect(code).toContain("pub fn deposit")
  expect(code).toContain("pub fn withdraw")
  expect(code).toContain("#[contractimpl]")
  expect(code).not.toContain("pub fn execute")
})

test("the FunctionEntry config panel only opens for the selected node", async ({ page }) => {
  await page.goto("/editor")
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()

  await zoomOut(page)
  await dropBlock(page, "FunctionEntry", { x: 500, y: 300 })

  const node = page.locator('[data-testid="block-node-FunctionEntry"]')
  await expect(node).toBeVisible()

  const panel = page.locator('[data-testid="function-entry-panel"]')
  await expect(panel).not.toBeVisible()

  await selectNode(page, '[data-testid="block-node-FunctionEntry"]')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-testid="function-name-input"]')).toBeVisible()
  await expect(panel.locator('[data-testid="function-visibility-select"]')).toBeVisible()

  // Declared parameters are editable and land in the emitted signature.
  await panel.locator('[data-testid="function-param-add"]').click()
  await panel.locator('[data-testid="function-param-name-0"]').fill("amount")
  await panel.locator('[data-testid="function-param-type-0"]').fill("i128")
  await expect(panel.locator('[data-testid="function-param-name-0"]')).toHaveValue("amount")
})

test("the code preview reports a duplicate function name instead of emitting code", async ({
  page,
}) => {
  await page.goto("/editor")
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()

  await zoomOut(page)
  await dropBlock(page, "FunctionEntry", { x: 420, y: 160 })
  await dropBlock(page, "FunctionReturn", { x: 420, y: 480 })
  await dropBlock(page, "FunctionEntry", { x: 900, y: 160 })
  await dropBlock(page, "FunctionReturn", { x: 900, y: 480 })

  await connect(page, '[data-testid="block-node-FunctionEntry"] >> nth=0', '[data-testid="block-node-FunctionReturn"] >> nth=0')
  await connect(page, '[data-testid="block-node-FunctionEntry"] >> nth=1', '[data-testid="block-node-FunctionReturn"] >> nth=1')

  await nameFunction(page, '[data-testid="block-node-FunctionEntry"] >> nth=0', "deposit")
  await nameFunction(page, '[data-testid="block-node-FunctionEntry"] >> nth=1', "deposit")

  await page.getByRole("button", { name: "Code Preview" }).click()

  await expect(page.getByText("Compilation Error")).toBeVisible()
  await expect(page.getByText(/deposit/)).toBeVisible()
})
