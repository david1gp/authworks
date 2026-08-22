import { expect, test } from "@playwright/test"

test("the administration demo navigates through its list pages", async ({ page }) => {
  await page.goto("/demo/admin")

  await expect(page.getByRole("heading", { name: "Administration directory", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "OpenID Connect", exact: true })).toBeVisible()

  const navigation = page.getByRole("navigation", { name: "Administration" })
  await navigation.getByRole("link", { name: "Organizations", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible()
  await expect(page.getByText("Acme Corporation", { exact: true })).toBeVisible()

  await expect(navigation.getByRole("link", { name: "Users", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Projects", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Sessions", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Events", exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Users", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/users$/)
  await expect(page.getByText("alex.morgan", { exact: true })).toBeVisible()

  await page.getByLabel("Search users", { exact: true }).fill("alex")
  await expect(page).toHaveURL(/q=alex/)

  await navigation.getByRole("link", { name: "Projects", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/projects$/)
  await expect(page.getByText("Acme Portal", { exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Sessions", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/sessions$/)
  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Events", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/events$/)
  await expect(page.getByText("organization.created", { exact: true })).toBeVisible()

  await page.goto("/demo/admin/organizations/01900000-0000-7000-8000-000000000011")
  await expect(page.getByRole("heading", { name: "Acme Corporation", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Members and roles", exact: true })).toBeVisible()
})

test("user detail shows stateless security metadata and revokes sessions", async ({ page }) => {
  const userDetail = "/demo/admin/users/01900000-0000-7000-8000-000000000021"
  await page.goto(userDetail)

  await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible()
  await expect(page.getByText("Firefox on Linux", { exact: true })).toBeVisible()
  await expect(page.getByText("Password", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Authentication methods", exact: true })).toBeVisible()
  await expect(page.getByText("1 passkeys", { exact: true })).toBeVisible()
  await expect(page.getByText(/Authenticator app · confirmed/)).toBeVisible()
  await expect(page.locator("[data-secret-value], [data-one-time-secret]")).toHaveCount(0)

  const mobileSession = page.locator('[data-admin-user-session="session-admin-mobile"]')
  await mobileSession.getByRole("button", { name: "Revoke session", exact: true }).click()
  await expect(mobileSession).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "The session was revoked." })).toBeVisible()

  await page.goto(`${userDetail}?state=empty`)
  await expect(page.getByRole("heading", { name: "This user has no active sessions.", exact: true })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "No authentication methods are configured.", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "error", exact: true }).click()
  await expect(page).toHaveURL(/state=error/)
  await expect(page.locator("[data-content-state='error']")).toContainText(
    "The deterministic administration fixture is unavailable.",
  )
})

test("an organization can be created from the demo list", async ({ page }) => {
  await page.goto("/demo/admin/organizations")
  await page.getByRole("button", { name: "Create organization", exact: true }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Create organization", exact: true })).toBeVisible()
  await dialog.getByLabel("Organization name", { exact: true }).fill("E2E Org")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("link", { name: "E2E Org", exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/create=/)
})
