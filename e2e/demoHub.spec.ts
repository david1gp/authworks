import { expect, test } from "@playwright/test"

test("the demo hub navigates to login, account, administration, and email previews", async ({ page }) => {
  await page.goto("/demo")

  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Login", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Email previews", exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Open login", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/login$/)
  await expect(page.getByRole("heading", { name: "Login demo", exact: true })).toBeVisible()

  await page.goto("/demo")
  await page.getByRole("link", { name: "Open account", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/account$/)
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible()

  await page.goto("/demo")
  await page.getByRole("link", { name: "Open administration", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin$/)
  await expect(page.getByRole("heading", { name: "Administration directory", exact: true })).toBeVisible()

  await page.goto("/demo")
  await page.getByRole("link", { name: "Open email previews", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/emails$/)
  await expect(page.getByRole("heading", { name: "Email previews", exact: true })).toBeVisible()
})
