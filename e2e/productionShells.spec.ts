import { expect, test } from "@playwright/test"

test("production focus and authenticated shells render without network adapters", async ({ page }) => {
  // `/login` now renders its own branded shell through the login feature adapter, so the shared
  // focus shell is exercised through `/consent` instead.
  await page.goto("/consent")
  await expect(page.getByRole("heading", { name: "Application consent", exact: true })).toBeVisible()
  await expect(page.locator('[data-shell="focus"]')).toBeVisible()
  await expect(page.locator('[data-content-state="empty"]')).toBeVisible()
  await expect(page.getByText("Production route placeholder")).toHaveCount(0)

  await page.goto("/account/sessions")
  await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Sessions and devices" })).toBeVisible()
  await expect(page.getByLabel("Realm")).toHaveValue("customer-identity")

  await page.goto("/invitations")
  await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible()

  await page.goto("/admin/users/user-42")
  await expect(page.getByRole("heading", { name: "User detail", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page")

  await page.goto("/admin/not-a-screen")
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible()
  await expect(page.locator('[data-content-state="inaccessible"]')).toBeVisible()
})

test("authenticated navigation becomes a mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/account")

  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Open sidebar" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Account" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sessions and devices", exact: true })).toBeVisible()
})
