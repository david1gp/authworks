import { expect } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"

test("the demo hub lists sections with bullet links", async ({ page }) => {
  await page.goto("/demo")

  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Login", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Email previews", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Application consent", exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Password", exact: true }).first().click()
  await expect(page).toHaveURL(/\/demo\/login\/password$/)
  await expect(page.getByRole("heading", { name: "Sign in with password" })).toBeVisible()

  await page.goto("/demo")
  await page.getByRole("link", { name: "Profile", exact: true }).first().click()
  await expect(page).toHaveURL(/\/demo\/account\/profile$/)
  await expect(page.getByRole("navigation", { name: "Fixture state", exact: true })).toHaveCount(0)

  await page.goto("/demo")
  await page.getByRole("link", { name: "User directory", exact: true }).first().click()
  await expect(page).toHaveURL(/\/demo\/admin\/users$/)
  await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible()

  await page.goto("/demo")
  await page.getByRole("link", { name: "Email verification", exact: true }).first().click()
  await expect(page).toHaveURL(/\/demo\/emails\/verification$/)
})
