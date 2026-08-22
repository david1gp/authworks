import { expect, test } from "@playwright/test"
import { productionAdminSessionBootstrap } from "./productionAdminSessionBootstrap.js"

// Payloads must satisfy the public UUIDv7-shaped resource identifier schema.
const realmId = "018f0000-0000-7000-8000-000000000001"
const machineUserId = "018f0000-0000-7000-8000-000000000071"
const credentialId = "018f0000-0000-7000-8000-000000000081"
const realmApiPath = new RegExp(`/realms/${realmId}/(?!sessions/current(?:\\?|$))`)

const machineUser = {
  createdAt: 1,
  displayName: "Billing Sync Service",
  id: machineUserId,
  realmId,
  scopes: ["billing.read", "billing.write"],
  status: "active",
  updatedAt: 1,
  userName: "billing-sync",
}
const credential = {
  createdAt: 1,
  id: credentialId,
  kind: "personal_access_token",
  machineUserId,
  name: "Deployment pipeline token",
  realmId,
  scopes: ["billing.read"],
}

test.beforeEach(async ({ page }) => {
  await productionAdminSessionBootstrap(page, {
    organizationId: "018f0000-0000-7000-8000-000000000002",
    organizationName: "Northwind Labs",
    realmId,
  })
})

test("the production machine user list reads the realm-scoped tenant API", async ({ page }) => {
  const requested: string[] = []
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requested.push(pathname)
    if (pathname.endsWith("/machine-users")) return route.fulfill({ json: { items: [machineUser] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/machine-users")

  await expect(page.getByText("Billing Sync Service", { exact: true })).toBeVisible()
  await expect(page.getByText("billing-sync", { exact: true })).toBeVisible()
  expect(requested).toContain(`/realms/${realmId}/machine-users`)
  // The browser must never reach the operator-only system surface.
  expect(requested.every((pathname) => !pathname.startsWith("/system/"))).toBe(true)
})

test("creating a machine user sends a CSRF-protected mutation and shows the credentials once", async ({ page }) => {
  let createHadCsrf = false
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/machine-users") && request.method() === "POST") {
      createHadCsrf = request.headers()["x-csrf-token"] !== undefined
      return route.fulfill({
        json: {
          clientId: "production-service",
          clientSecret: "p".repeat(43),
          machineUser: { ...machineUser, displayName: "Production Service", userName: "production-service" },
        },
      })
    }
    if (pathname.endsWith("/machine-users")) return route.fulfill({ json: { items: [machineUser] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/machine-users")
  await expect(page.getByText("Billing Sync Service", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Create machine user", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Display name", { exact: true }).fill("Production Service")
  await dialog.getByLabel("User name", { exact: true }).fill("production-service")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-client-id]")).toContainText("production-service")
  await expect(panel.locator("[data-secret-value]")).toContainText("p".repeat(43))
  expect(createHadCsrf).toBe(true)
})

test("rotating a client secret posts to the dedicated path and never re-reads the value", async ({ page }) => {
  let rotateHadCsrf = false
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/client-secret/rotate")) {
      rotateHadCsrf = request.headers()["x-csrf-token"] !== undefined
      return route.fulfill({
        json: { clientId: machineUser.userName, clientSecret: "r".repeat(43), machineUser },
      })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)
  // The stored secret is only ever presented as redacted before rotation.
  await expect(page.locator("[data-secret-redacted]")).toBeVisible()
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)

  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Rotate client secret", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel.locator("[data-secret-value]")).toContainText("r".repeat(43))
  expect(rotateHadCsrf).toBe(true)
})

test("client secret rotation is confirmed before the destructive mutation is sent", async ({ page }) => {
  let rotateRequested = false
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/client-secret/rotate")) {
      rotateRequested = true
      return route.fulfill({
        json: { clientId: machineUser.userName, clientSecret: "r".repeat(43), machineUser },
      })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)
  await expect(page.locator("[data-secret-redacted]")).toBeVisible()

  // A dismissed confirmation must not send the destructive mutation.
  page.once("dialog", (dialog) => void dialog.dismiss())
  await page.getByRole("button", { name: "Rotate client secret", exact: true }).click()
  await expect(page.locator("[data-one-time-secret='machine-credential']")).toHaveCount(0)
  expect(rotateRequested).toBe(false)
})

test("issuing a personal access token posts to the token path and shows the value once", async ({ page }) => {
  let tokenPath = ""
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/personal-access-tokens")) {
      tokenPath = pathname
      return route.fulfill({
        json: { credential: { ...credential, name: "Pipeline Token" }, secret: "t".repeat(43) },
      })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)
  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Credential type", { exact: true }).selectOption("personal_access_token")
  await dialog.getByLabel("Name", { exact: true }).fill("Pipeline Token")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toContainText("New personal access token")
  await expect(panel.locator("[data-secret-value]")).toContainText("t".repeat(43))
  expect(tokenPath).toBe(`/realms/${realmId}/machine-users/${machineUserId}/personal-access-tokens`)
})

test("issuing an API key posts an expiry to the API key path", async ({ page }) => {
  let apiKeyBody: unknown
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/api-keys")) {
      apiKeyBody = request.postDataJSON()
      return route.fulfill({
        json: {
          credential: { ...credential, kind: "api_key", name: "Integration Key" },
          secret: "k".repeat(43),
        },
      })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)
  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Credential type", { exact: true }).selectOption("api_key")
  await dialog.getByLabel("Name", { exact: true }).fill("Integration Key")
  await dialog.getByLabel("Expires", { exact: true }).fill("2030-01-01")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toContainText("New API key")
  await expect(panel.locator("[data-secret-value]")).toContainText("k".repeat(43))
  expect(apiKeyBody).toMatchObject({ expiresAt: Date.parse("2030-01-01"), name: "Integration Key" })
})

test("credential revocation is confirmed and posts to the credential path", async ({ page }) => {
  let revokePath = ""
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/revoke")) {
      revokePath = pathname
      return route.fulfill({ json: { credential: { ...credential, revokedAt: 2 } } })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)
  const row = page.getByRole("row").filter({ hasText: "Deployment pipeline token" })
  await expect(row).toContainText("Active")

  // A dismissed confirmation must not revoke the credential.
  page.once("dialog", (dialog) => void dialog.dismiss())
  await row.getByRole("button", { name: "Revoke", exact: true }).click()
  expect(revokePath).toBe("")

  page.once("dialog", (dialog) => void dialog.accept())
  await row.getByRole("button", { name: "Revoke", exact: true }).click()

  await expect(page.getByRole("status")).toContainText("revoked")
  await expect(row).toContainText("Revoked")
  expect(revokePath).toBe(`/realms/${realmId}/machine-credentials/${credentialId}/revoke`)
})

test("machine user removal is confirmed before the lifecycle mutation is sent", async ({ page }) => {
  let lifecycleBody: unknown
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/lifecycle")) {
      lifecycleBody = request.postDataJSON()
      return route.fulfill({ json: { machineUser: { ...machineUser, status: "removed" } } })
    }
    if (pathname.endsWith("/credentials")) return route.fulfill({ json: { items: [credential] } })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/machine-users/${machineUserId}`)

  page.once("dialog", (dialog) => void dialog.dismiss())
  await page.getByRole("button", { name: "Remove machine user", exact: true }).click()
  expect(lifecycleBody).toBeUndefined()

  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Remove machine user", exact: true }).click()

  // Removal navigates back to the directory once the lifecycle mutation succeeds.
  await expect(page).toHaveURL(/\/admin\/machine-users$/)
  expect(lifecycleBody).toMatchObject({ status: "removed" })
})

test("a listed credential never exposes a stored secret value", async ({ page }) => {
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/credentials"))
      return route.fulfill({
        json: {
          items: [
            credential,
            {
              ...credential,
              id: `${credentialId.slice(0, -1)}2`,
              kind: "client_secret",
              name: "Client secret",
            },
          ],
        },
      })
    if (pathname.endsWith(`/machine-users/${machineUserId}`)) return route.fulfill({ json: { machineUser } })
    if (pathname.endsWith("/machine-users")) return route.fulfill({ json: { items: [machineUser] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/machine-credentials")

  await expect(page.getByRole("row").filter({ hasText: "Deployment pipeline token" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "Client secret" }).first()).toBeVisible()
  // Only metadata is rendered; a stored credential value is never present.
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

test("permission, assurance, and tenant failures render distinct inaccessible states", async ({ page }) => {
  await page.route(realmApiPath, async (route) =>
    route.fulfill({
      json: {
        error: { code: "machine-users.forbidden", message: "Denied.", op: "machineUserList", status: 403 },
      },
      status: 403,
    }),
  )
  await page.goto("/admin/machine-users")
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("permission")

  await page.route(realmApiPath, async (route) =>
    route.fulfill({
      json: {
        error: {
          code: "authorization.insufficient-assurance",
          message: "Step up.",
          op: "machineUserGet",
          status: 403,
        },
      },
      status: 403,
    }),
  )
  await page.goto(`/admin/machine-users/${machineUserId}`)
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("stronger")

  await page.route(realmApiPath, async (route) =>
    route.fulfill({
      json: {
        error: {
          code: "machine-users.tenant-mismatch",
          message: "Other realm.",
          op: "machineUserGet",
          status: 404,
        },
      },
      status: 404,
    }),
  )
  await page.goto(`/admin/machine-users/${machineUserId}`)
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("different realm")
})
