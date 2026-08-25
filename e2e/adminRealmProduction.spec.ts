import { expect, test } from "@playwright/test"

const realmId = "01900000-0000-7000-8000-000000000001"
const discoveryBody = {
  branding: {
    dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
    disableWatermark: true,
    light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
    themeMode: "system",
  },
  domain: "auth.example",
  found: true,
  organization: {
    id: "01900000-0000-7000-8000-000000000002",
    name: "Customer identity",
    realmId,
  },
  policy: {
    allowDomainDiscovery: true,
    allowEmailOtp: true,
    allowExternalIdentity: true,
    allowPassword: true,
    allowPasswordRecovery: true,
    allowPasskey: true,
    allowRegistration: true,
    providerIds: [],
  },
  providers: [],
}
const realmBody = (overrides: Record<string, unknown> = {}) => ({
  realm: {
    createdAt: 1_700_000_000_000,
    domain: "auth.example",
    domains: ["auth.example"],
    id: "01900000-0000-7000-8000-000000000001",
    name: "Customer identity",
    status: "active",
    updatedAt: 1_700_000_100_000,
    ...overrides,
  },
})
const sessionBody = {
  session: {
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    createdAt: 1_700_000_000_000,
    current: true,
    device: {},
    expiresAt: 1_700_000_900_000,
    id: "01900000-0000-7000-8000-0000000000a1",
    lastUsedAt: 1_700_000_000_000,
    realmId: "01900000-0000-7000-8000-000000000001",
    revokedAt: null,
    subjectId: "01900000-0000-7000-8000-0000000000b1",
    subjectType: "bootstrap_admin",
  },
}

test.beforeEach(async ({ page }) => {
  await page.route("**/organization-discovery", (route) => route.fulfill({ json: discoveryBody }))
})

test("production administrator sign-in posts the credential once and never stores it", async ({ page }) => {
  let signInBody: string | null = null
  let signInCount = 0
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/admin/sign-in")) {
      signInCount += 1
      signInBody = request.postData()
      return route.fulfill({
        json: {
          adminId: "01900000-0000-7000-8000-0000000000b1",
          expiresAt: 1_700_000_900_000,
          realmId: "01900000-0000-7000-8000-000000000001",
          sessionId: "01900000-0000-7000-8000-0000000000a1",
        },
      })
    }
    return route.abort()
  })

  await page.goto("/admin/sign-in")
  await page.getByLabel("Bootstrap administrator credential", { exact: true }).fill("e".repeat(48))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()
  expect(signInCount).toBe(1)
  expect(signInBody).toBe(JSON.stringify({ secret: "e".repeat(48) }))
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(stored).not.toContain("eeee")
})

test("production realm overview reads the session and realm over cookie routes", async ({ page }) => {
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/current")) return route.fulfill({ json: sessionBody })
    return route.abort()
  })
  await page.route(`**/realms/${realmId}`, (route) => route.fulfill({ json: realmBody() }))

  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Customer identity", exact: true })).toBeVisible()
  await expect(page.getByText("auth.example", { exact: true }).first()).toBeVisible()
})

test("production sessions route renders the existing administrator session view", async ({ page }) => {
  await page.route(`**/realms/${realmId}/sessions/current`, (route) => route.fulfill({ json: sessionBody }))
  await page.route(`**/realms/${realmId}`, (route) => route.fulfill({ json: realmBody() }))

  await page.goto("/admin/sessions")

  await expect(page.locator("[data-admin-session='active']")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()
  await expect(page.getByText("This page is ready for its feature content.")).toHaveCount(0)
})

test("production realm settings send a CSRF token and surface permission denial", async ({ page }) => {
  let updateCsrfToken: string | undefined
  let updateStatus = 200
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/sessions/current")) return route.fulfill({ json: sessionBody })
    return route.abort()
  })
  await page.route(`**/realms/${realmId}`, async (route) => {
    const request = route.request()
    if (request.method() !== "PATCH") return route.fulfill({ json: realmBody() })
    updateCsrfToken = request.headers()["x-csrf-token"]
    if (updateStatus === 403)
      return route.fulfill({
        json: {
          error: {
            code: "realms.forbidden",
            message: "You do not have permission to change this realm.",
            op: "realmTenantUpdate",
            status: 403,
          },
        },
        status: 403,
      })
    return route.fulfill({ json: realmBody({ name: "Renamed realm" }) })
  })

  await page.goto("/admin/realm")
  await page.getByLabel("Realm name", { exact: true }).fill("Renamed realm")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("saved")
  expect(updateCsrfToken).toBe("csrf-e2e")

  updateStatus = 403
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("do not have permission to change this realm")
})

test("production realm settings render an expired administrator session", async ({ page }) => {
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/current"))
      return route.fulfill({
        json: {
          error: {
            code: "sessions.unauthorized",
            message: "The administrator session has expired.",
            op: "sessionCurrent",
            status: 401,
          },
        },
        status: 401,
      })
    return route.abort()
  })

  await page.goto("/admin/realm")
  await expect(page).toHaveURL("/login?return_to=%2Fadmin%2Frealm")
})
