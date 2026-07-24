import { test, expect } from "@playwright/test"

test("requires confirmation before switching to Mainnet", async ({ page }) => {
  await page.goto("/editor")

  const selector = page.getByLabel("Stellar network")
  const badge = page.getByTestId("network-badge")

  await expect(selector).toHaveValue("testnet")
  await expect(badge).toHaveText("Testnet")

  await selector.selectOption("mainnet")
  const dialog = page.getByRole("dialog", { name: "Switch to Mainnet?" })
  await expect(dialog).toBeVisible()
  await expect(selector).toHaveValue("testnet")

  const confirmButton = dialog.getByRole("button", { name: "Switch to Mainnet" })
  await expect(confirmButton).toBeDisabled()
  await dialog.getByLabel("I understand this uses real XLM").check()
  await confirmButton.click()

  await expect(dialog).toBeHidden()
  await expect(selector).toHaveValue("mainnet")
  await expect(badge).toHaveText("Mainnet")
})
