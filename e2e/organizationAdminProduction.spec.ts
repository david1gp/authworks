import { expect, test } from "@playwright/test"
import { productionAdminSessionBootstrap } from "./productionAdminSessionBootstrap.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"
const realmApiPath = new RegExp(`/realms/${realmId}/(?!sessions/current(?:\\?|$))`)

const organization = {
  createdAt: 1_755_782_400_000,
  id: organizationId,
  name: "Northwind Labs",
  realmId,
  status: "active",
  updatedAt: 1_755_782_400_000,
}

const membership = {
  createdAt: 1_755_782_400_000,
  id: "018f0000-0000-7000-8000-000000000003",
  organizationId,
  realmId,
  roles: ["member"],
  updatedAt: 1_755_782_400_000,
  userId: "user-1",
}

const roles = [
  { id: "owner", name: "Owner" },
  { id: "admin", name: "Administrator" },
  { id: "member", name: "Member" },
  { id: "guest", name: "Guest" },
]

test.beforeEach(async ({ page }) => {
  await productionAdminSessionBootstrap(page, { organizationId, organizationName: organization.name, realmId })
})

test("production membership role changes send a CSRF-protected PATCH", async ({ page }) => {
  let patchHadCsrf = false
  let patchBody: unknown

  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/organization-roles")) return route.fulfill({ json: { items: roles } })
    if (pathname.endsWith("/memberships") && request.method() === "GET")
      return route.fulfill({ json: { items: [membership] } })
    if (pathname.includes("/memberships/") && request.method() === "PATCH") {
      patchHadCsrf = request.headers()["x-csrf-token"] === "csrf-e2e"
      patchBody = request.postDataJSON()
      return route.fulfill({ json: { membership: { ...membership, roles: ["member", "admin"] } } })
    }
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/memberships")
  await expect(page.getByText("user-1", { exact: true })).toBeVisible()

  await page
    .getByRole("row", { name: /user-1/ })
    .getByLabel("Administrator", { exact: true })
    .check()
  await expect(page.getByRole("status")).toContainText("The member roles were updated.")
  expect(patchHadCsrf).toBe(true)
  expect(patchBody).toEqual({ roles: ["member", "admin"] })
})

test("production organization pages surface permission and assurance failures", async ({ page }) => {
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    return route.fulfill({
      json: {
        error: {
          code: "organizations.forbidden",
          message: "You cannot manage this organization.",
          op: "organizationList",
          status: 403,
        },
      },
      status: 403,
    })
  })

  await page.goto("/admin/organizations")
  await expect(page.getByRole("heading", { name: "Access unavailable", exact: true })).toBeVisible()
  await expect(page.getByText("You do not have permission to view or change this organization.")).toBeVisible()
})

test("production organization creation posts through the realm-scoped browser route", async ({ page }) => {
  const createdNames: string[] = []

  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/organizations") && request.method() === "POST") {
      createdNames.push((request.postDataJSON() as { name: string }).name)
      return route.fulfill({ json: { organization } })
    }
    if (pathname.endsWith("/organizations") && request.method() === "GET")
      return route.fulfill({ json: { items: createdNames.length === 0 ? [] : [organization] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/organizations")
  await page.getByRole("button", { name: "Create organization", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Organization name", { exact: true }).fill("Northwind Labs")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("link", { name: "Northwind Labs", exact: true })).toBeVisible()
  expect(createdNames).toEqual(["Northwind Labs"])
})

test("a production provider secret rotation never reveals the stored secret", async ({ page }) => {
  const provider = {
    allowAccountCreation: true,
    clientId: "client-id",
    createdAt: 1_755_782_400_000,
    displayName: "Google Workspace",
    enabled: true,
    id: "018f0000-0000-7000-8000-000000000004",
    organizationId,
    realmId,
    redirectUri: "https://auth.example/callback",
    scopes: ["openid", "email"],
    type: "google",
    updatedAt: 1_755_782_400_000,
    version: 1,
  }
  let rotationBody: Record<string, unknown> | undefined

  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.includes("/external-identity-providers/") && request.method() === "PATCH") {
      rotationBody = request.postDataJSON() as Record<string, unknown>
      return route.fulfill({ json: { provider: { ...provider, version: 2 } } })
    }
    if (pathname.endsWith("/external-identity-providers")) return route.fulfill({ json: { items: [provider] } })
    if (pathname.endsWith("/login-policy"))
      return route.fulfill({
        json: {
          organizationId,
          overrides: {},
          policy: {
            allowDomainDiscovery: true,
            allowEmailOtp: true,
            allowExternalIdentity: true,
            allowPasskey: true,
            allowPassword: true,
            allowPasswordRecovery: true,
            allowRegistration: true,
            providerIds: null,
          },
          realmId,
        },
      })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/login-policy")
  await expect(page.getByRole("heading", { name: "Google Workspace", exact: true })).toBeVisible()

  const secretField = page.getByLabel("Client secret").first()
  await expect(secretField).toHaveValue("")
  await secretField.fill("rotated-secret")
  await page.getByRole("button", { name: "Replace client secret" }).first().click()

  await expect(page.getByRole("status")).toContainText("The client secret was replaced.")
  expect(rotationBody).toEqual({ clientSecret: "rotated-secret" })
  await expect(secretField).toHaveValue("")
})
