import { expect, test } from "@playwright/test"

test("desktop sidebar collapse releases demo content space", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/demo/admin")

  const main = page.locator("main")
  await expect(main).toHaveCSS("margin-left", "240px")
  await page.getByRole("button", { name: "Hide sidebar", exact: true }).click()
  await expect(page.locator("aside")).toHaveCount(0)
  await expect(main).toHaveCSS("margin-left", "0px")

  await page.getByRole("button", { name: "Open sidebar" }).click()
  await expect(page.locator("aside")).toHaveCount(1)
  await expect(main).toHaveCSS("margin-left", "240px")
})

test("the administration demo navigates through its list pages", async ({ page }) => {
  await page.goto("/demo/admin")

  const content = page.locator("main")
  await expect(content.getByRole("heading", { name: "Administration directory", exact: true })).toBeVisible()
  await expect(content.getByRole("heading", { name: "OpenID Connect", exact: true })).toBeVisible()

  const navigation = page.getByRole("navigation", { name: "Administration" })
  for (const label of [
    "Directory",
    "Administrator sign-in",
    "Realm overview",
    "Realm settings",
    "Organizations",
    "Members and roles",
    "Invitations",
    "Domains",
    "Users",
    "Projects",
    "OIDC clients",
    "Signing keys",
    "Application consents",
    "Protocol documents",
    "Sessions",
    "Events",
  ]) {
    await expect(navigation.getByRole("link", { name: label, exact: true }).locator("svg")).toHaveCount(1)
  }
  await expect(page.getByLabel("Language").locator("..").locator("svg")).toHaveCount(1)
  await navigation.getByRole("link", { name: "Organizations", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Organization directory", exact: true })).toBeVisible()
  // Organizations render as a wide table on desktop and as a stacked record list on mobile.
  await expect(page.getByRole("table").getByText("Acme Corporation", { exact: true })).toBeVisible()

  await expect(navigation.getByRole("link", { name: "Users", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Projects", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Sessions", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Events", exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Users", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/users$/)
  // Users render as a wide table on desktop and as a stacked record list on mobile; assert the visible one.
  await expect(page.getByRole("table").getByText("alex.morgan", { exact: true })).toBeVisible()

  await page.getByLabel("Search users", { exact: true }).fill("alex")
  await expect(page).toHaveURL(/q=alex/)

  await navigation.getByRole("link", { name: "Projects", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/projects$/)
  await expect(page.getByRole("table").getByText("Acme Portal", { exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Sessions", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/sessions$/)
  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()

  await navigation.getByRole("link", { name: "Events", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/admin\/events$/)
  await expect(page.getByRole("table").getByText("organization.created", { exact: true })).toBeVisible()

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
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Revoke this session immediately? The device is signed out at once.")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(mobileSession).toBeVisible()

  await mobileSession.getByRole("button", { name: "Revoke session", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
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

  await expect(page.getByRole("table").getByRole("link", { name: "E2E Org", exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/create=/)
})
