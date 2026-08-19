import { expect, test } from "@playwright/test"

test("the administration demo navigates through its list pages", async ({ page }) => {
  await page.goto("/demo/admin")

  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible()
  await expect(page.getByText("Acme Corporation", { exact: true })).toBeVisible()

  const navigation = page.getByRole("navigation", { name: "Administration" })
  await expect(navigation.getByRole("link", { name: "Users", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Projects", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Events", exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Users", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/users$/)
  await expect(page.getByText("alex.morgan", { exact: true })).toBeVisible()

  await page.getByLabel("Search users", { exact: true }).fill("alex")
  await expect(page).toHaveURL(/q=alex/)

  await navigation.getByRole("link", { name: "Projects", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/projects$/)
  await expect(page.getByText("Acme Portal", { exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Events", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/events$/)
  await expect(page.getByText("organization.created", { exact: true })).toBeVisible()

  await page.goto("/demo/admin/organizations/01900000-0000-7000-8000-000000000011")
  await expect(page.getByRole("heading", { name: "Memberships", exact: true })).toBeVisible()
  await expect(page.getByText("Alex Morgan", { exact: true })).toBeVisible()
})

test("an organization can be created from the demo list", async ({ page }) => {
  await page.goto("/demo/admin/organizations")
  await page.getByRole("button", { name: "Create organization", exact: true }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Create organization", exact: true })).toBeVisible()
  await dialog.getByLabel("Name", { exact: true }).fill("E2E Org")
  await dialog.getByRole("button", { name: "Create", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Create organization", exact: true })).toHaveCount(0)
  await expect(page.getByText("E2E Org", { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/create=/)
})
