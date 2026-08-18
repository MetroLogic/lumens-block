import { test, expect, type Page } from "@playwright/test"

const CONTRACT_ID = "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"

/**
 * Drops a toolbar block onto the canvas at a fraction of the canvas size.
 * BlockEditor.onDrop reads the "application/blocktype" DataTransfer payload.
 */
async function dropBlock(page: Page, blockType: string, fx: number, fy: number) {
  const canvas = page.locator('[data-testid="editor-canvas"]')
  const box = await canvas.boundingBox()
  if (!box) throw new Error("canvas has no bounding box")

  await page.evaluate(
    ({ sourceId, blockType, clientX, clientY }) => {
      const source = document.querySelector(`[data-testid="${sourceId}"]`)
      const target = document.querySelector('[data-testid="editor-canvas"]')
      if (!source || !target) return

      const dataTransfer = new DataTransfer()
      dataTransfer.setData("application/blocktype", blockType)

      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }))
      target.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, clientX, clientY, dataTransfer })
      )
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, clientX, clientY, dataTransfer })
      )
    },
    {
      sourceId: `toolbar-block-${blockType.toLowerCase()}`,
      blockType,
      clientX: box.x + box.width * fx,
      clientY: box.y + box.height * fy,
    }
  )
}

/**
 * Test: a Cross-Contract Call block can be dropped on the canvas and configured.
 *
 * The block is dragged out of the toolbar with a real DataTransfer payload
 * (BlockEditor.onDrop reads "application/blocktype"), selected, and then
 * configured with a target contract address and function name. While either
 * field is empty the panel shows a validation message; once both are filled
 * the message disappears.
 */
test("drag a Cross-Contract Call block onto the canvas and configure it", async ({ page }) => {
  await page.goto("/editor")

  const toolbar = page.locator('[data-testid="toolbar"]')
  const canvas = page.locator('[data-testid="editor-canvas"]')
  await expect(toolbar).toBeVisible()
  await expect(canvas).toBeVisible()

  const toolbarBlock = page.locator('[data-testid="toolbar-block-crosscontractcall"]')
  await expect(toolbarBlock).toBeVisible()

  // Drop the block on the canvas
  await dropBlock(page, "CrossContractCall", 0.5, 0.3)

  const node = page.locator('[data-testid="block-node-CrossContractCall"]')
  await expect(node).toBeVisible()

  // The config panel opens only once the node is selected
  const panel = page.locator('[data-testid="cross-contract-config-panel"]')
  await expect(panel).not.toBeVisible()

  await node.click()
  await expect(panel).toBeVisible()

  // Both required fields are empty → the panel reports it
  const error = page.locator('[data-testid="cross-contract-error"]')
  await expect(error).toBeVisible()

  // Fill in the target contract and function
  await page.locator('[data-testid="cross-contract-address"]').fill(CONTRACT_ID)
  await page.locator('[data-testid="cross-contract-function"]').fill("stake")

  // Add two arguments: one sourced from an invocation argument, one literal
  await page.locator('[data-testid="cross-contract-add-arg"]').click()
  await page.locator('[data-testid="cross-contract-arg-name-0"]').fill("caller")
  await page.locator('[data-testid="cross-contract-arg-type-0"]').selectOption("Address")
  await page.locator('[data-testid="cross-contract-arg-source-0"]').selectOption("invocationArg")
  await page.locator('[data-testid="cross-contract-arg-value-0"]').selectOption("caller")

  await page.locator('[data-testid="cross-contract-add-arg"]').click()
  await page.locator('[data-testid="cross-contract-arg-name-1"]').fill("amount")
  await page.locator('[data-testid="cross-contract-arg-type-1"]').selectOption("i128")
  await page.locator('[data-testid="cross-contract-arg-value-1"]').fill("100")

  // Bind the return value so downstream Condition blocks can use it
  await page.locator('[data-testid="cross-contract-return-binding"]').fill("stake_result")
  await page.locator('[data-testid="cross-contract-return-type"]').selectOption("i128")

  // A fully configured block shows no validation error
  await expect(error).not.toBeVisible()

  // The node header reflects the configured function
  await expect(node).toContainText("stake()")
})

/**
 * Test: a CrossContractCall `returnBinding` is offered as an operand inside a
 * downstream Condition block's expression builder.
 */
test("a bound return value is selectable in a Condition block", async ({ page }) => {
  await page.goto("/editor")

  const canvas = page.locator('[data-testid="editor-canvas"]')
  await expect(canvas).toBeVisible()

  // Drop the two blocks far enough apart that neither config panel covers the other
  await dropBlock(page, "CrossContractCall", 0.35, 0.6)
  await dropBlock(page, "Condition", 0.75, 0.2)

  const crossNode = page.locator('[data-testid="block-node-CrossContractCall"]')
  await expect(crossNode).toBeVisible()

  await crossNode.click()
  await page.locator('[data-testid="cross-contract-address"]').fill(CONTRACT_ID)
  await page.locator('[data-testid="cross-contract-function"]').fill("stake")
  await page.locator('[data-testid="cross-contract-return-binding"]').fill("stake_result")

  const conditionNode = page.locator('[data-testid="block-node-Condition"]')
  await expect(conditionNode).toBeVisible()
  await conditionNode.click()

  const configPanel = page.locator('[data-testid="config-panel"]')
  await expect(configPanel).toBeVisible()

  // The left operand defaults to the "Argument" type — the binding is an option
  const leftValue = configPanel.locator("#condition-left-value")
  await expect(leftValue.locator('option[value="stake_result"]')).toHaveCount(1)

  await leftValue.selectOption("stake_result")
  await expect(leftValue).toHaveValue("stake_result")
})
