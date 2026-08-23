import { expect, test } from "@playwright/test"

const organizationPath = "/demo/admin/organizations/01900000-0000-7000-8000-000000000011"

test("organization administration demo destinations render fixture-backed content", async ({ page }) => {
  await page.goto("/demo/admin/organizations")
  await expect(page.getByRole("link", { name: "Acme Corporation", exact: true })).toBeVisible()

  await page.goto(organizationPath)
  await expect(page.getByRole("heading", { name: "Organization settings", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Deactivate organization", exact: true })).toBeVisible()

  await page.goto("/demo/admin/memberships")
  await expect(page.getByRole("heading", { name: "Add member", exact: true })).toBeVisible()
  await expect(page.getByText("Roles are fixed by Authworks and cannot be renamed.")).toBeVisible()

  await page.goto("/demo/admin/invitations")
  await expect(page.getByText("rowan@example.com", { exact: true })).toBeVisible()

  await page.goto("/demo/admin/domains")
  await expect(page.getByRole("heading", { name: "acme.example", exact: true })).toBeVisible()
  await expect(page.getByText("Add this DNS TXT record, then verify.")).toBeVisible()

  await page.goto("/demo/admin/branding")
  await expect(page.getByRole("heading", { name: "Light theme" }).first()).toBeVisible()

  await page.goto("/demo/admin/login-policy")
  await expect(page.getByRole("heading", { level: 1, name: "Login policy", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Google Workspace", exact: true })).toBeVisible()
})

test("every organization demo page exposes empty, loading, error, and denied states", async ({ page }) => {
  await page.goto("/demo/admin/memberships?state=empty")
  await expect(page.getByText("This organization has no members yet.")).toBeVisible()

  await page.goto("/demo/admin/memberships?state=error")
  await expect(page.locator("[data-content-state='error']")).toBeVisible()

  await page.goto("/demo/admin/memberships?state=loading")
  await expect(page.locator("[data-content-state='loading']")).toBeVisible()

  await page.goto("/demo/admin/memberships?state=permission-denied")
  await expect(page.getByRole("heading", { name: "Access unavailable", exact: true })).toBeVisible()
  await expect(page.getByText("You do not have permission to view or change this organization.")).toBeVisible()

  await page.getByRole("link", { name: "empty", exact: true }).click()
  await expect(page).toHaveURL(/state=empty/)
})

test("a stored provider client secret is never displayed and can be replaced", async ({ page }) => {
  await page.goto("/demo/admin/login-policy")

  const secretField = page.getByLabel("Client secret").first()
  await expect(secretField).toHaveAttribute("type", "password")
  await expect(secretField).toHaveValue("")
  await expect(
    page.getByText("The stored client secret is never shown. Enter a new value to replace it.").first(),
  ).toBeVisible()

  await secretField.fill("replacement-secret")
  await page.getByRole("button", { name: "Replace client secret" }).first().click()
  await expect(page.getByRole("status")).toContainText("The client secret was replaced.")
  await expect(secretField).toHaveValue("")
})

test("an invitation link is shown once and is not repeated in the list", async ({ page }) => {
  await page.goto("/demo/admin/invitations")

  await page.getByLabel("Email address", { exact: true }).fill("newcomer@example.com")
  await page.getByRole("button", { name: "Invite person", exact: true }).click()

  const onceOnly = page.locator("[data-one-time-secret='organization-invitation']")
  await expect(onceOnly).toBeVisible()
  await expect(onceOnly).toContainText("This invitation link is shown once.")

  await onceOnly.getByRole("button", { name: "I saved this link", exact: true }).click()
  await expect(onceOnly).toHaveCount(0)
  await expect(page.getByText("newcomer@example.com", { exact: true })).toBeVisible()
})

test("destructive organization actions require confirmation", async ({ page }) => {
  await page.goto(organizationPath)

  const removeButton = page.getByRole("button", { name: "Remove organization", exact: true })
  await removeButton.click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Remove this organization? Members lose access while it is not active.")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(removeButton).toBeVisible()
  await expect(page.getByRole("heading", { name: "Acme Corporation", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Deactivate organization", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText("Deactivate this organization? Members lose access while it is not active.")
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("The organization lifecycle status was changed.")
})

test("domain discovery preview resolves a claimed domain without a network request", async ({ page }) => {
  await page.goto("/demo/admin/domains")

  await page.getByLabel("Domain", { exact: true }).last().fill("acme.example")
  await page.getByRole("button", { name: "Discovery preview", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("acme.example resolves to Acme Corporation.")
})
