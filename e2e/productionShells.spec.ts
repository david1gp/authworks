import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const realmId = "01900000-0000-7000-8000-000000000001"
const discovery = {
  branding: {
    dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
    disableWatermark: true,
    light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
    themeMode: "system",
  },
  domain: "customer.example",
  found: true,
  organization: { id: "01900000-0000-7000-8000-000000000002", name: "Customer identity", realmId },
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
const session = {
  session: {
    assurance: "authenticated",
    authenticationMethod: "password",
    createdAt: 1_700_000_000_000,
    current: true,
    device: {},
    expiresAt: 1_700_000_900_000,
    id: "01900000-0000-7000-8000-0000000000a1",
    lastUsedAt: 1_700_000_000_000,
    realmId,
    revokedAt: null,
    subjectId: "01900000-0000-7000-8000-0000000000b1",
    subjectType: "user",
    userId: "01900000-0000-7000-8000-0000000000b1",
  },
}
const realm = {
  realm: {
    createdAt: 1_700_000_000_000,
    domain: "customer.example",
    domains: ["customer.example"],
    id: realmId,
    name: "customer-identity",
    status: "active",
    updatedAt: 1_700_000_100_000,
  },
}

test.beforeEach(async ({ page }) => {
  await page.route("**/organization-discovery", (route) => route.fulfill({ json: discovery }))
  await page.route(`**/realms/${realmId}/sessions/current`, (route) => route.fulfill({ json: session }))
  await page.route(`**/realms/${realmId}/me/emails`, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            createdAt: 1_700_000_000_000,
            email: "user@customer.example",
            id: "production-shell-primary-email",
            isPrimary: true,
            updatedAt: 1_700_000_000_000,
            verified: true,
            verifiedAt: 1_700_000_000_000,
            version: 1,
          },
        ],
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me`, (route) =>
    route.fulfill({
      json: {
        user: {
          createdAt: 1_700_000_000_000,
          email: "user@customer.example",
          emailVerified: true,
          id: "01900000-0000-7000-8000-0000000000b1",
          profile: { displayName: "Customer user" },
          realmId,
          state: "active",
          updatedAt: 1_700_000_000_000,
          userName: "customer-user",
          verificationState: "verified",
        },
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me/organizations`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}`, (route) => route.fulfill({ json: realm }))
  await page.route(`**/realms/${realmId}/me/sessions`, (route) => route.fulfill({ json: { items: [] } }))
})

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
  const navigation = page.getByRole("navigation", { name: "Sessions and devices" })
  await expect(navigation).toBeVisible()
  for (const label of [
    "Overview",
    "Profile",
    "Email address",
    "Organizations",
    "Password",
    "Sessions and devices",
    "Passkeys",
    "Multi-factor authentication",
    "Recovery codes",
    "Linked identities",
    "Application consents",
    "Delete account",
  ]) {
    await expect(navigation.getByRole("link", { name: label, exact: true }).locator("svg")).toHaveCount(1)
  }
  for (const label of ["Security", "Access"]) {
    await expect(navigation.locator("h2").filter({ hasText: label }).locator("svg")).toHaveCount(1)
  }
  await expect(page.getByLabel("Realm").locator("..").locator("svg")).toHaveCount(1)
  await expect(page.getByLabel("Organization").locator("..").locator("svg")).toHaveCount(1)
  await expect(page.getByLabel("Language").locator("..").locator("svg")).toHaveCount(1)
  await expect(page.getByText("Signed in", { exact: true }).locator("svg")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Sign out", exact: true }).locator("svg")).toHaveCount(1)
  await expect(page.getByLabel("Realm")).toHaveValue(realmId)

  await page.goto("/invitations")
  await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible()

  await page.goto("/admin/users/user-42")
  await expect(page.getByRole("heading", { name: "User detail", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page")
})

test("unauthenticated protected routes redirect to login with their destination preserved", async ({ page }) => {
  await page.route(`**/realms/${realmId}/sessions/current`, (route) => route.fulfill({ body: "", status: 401 }))

  await page.goto("/admin/not-a-screen?from=bookmark#details")

  await expect(page).toHaveURL("/login?return_to=%2Fadmin%2Fnot-a-screen%3Ffrom%3Dbookmark%23details")
  expect(new URL(page.url()).searchParams.get("return_to")).toBe("/admin/not-a-screen?from=bookmark#details")
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

test("account email keeps sidebar branding while matching active icon and work-area headings", async ({ page }) => {
  await page.goto("/account/email")

  const activeEmailLink = page.getByRole("link", { name: "Email address", exact: true })
  const activeLinkColor = await activeEmailLink.evaluate((element) => getComputedStyle(element).color)

  await expect(activeEmailLink).toHaveAttribute("aria-current", "page")
  await expect(activeEmailLink.locator("svg")).toHaveCSS("fill", activeLinkColor)
  await expect(page.locator("main").getByText("Authworks", { exact: true })).toHaveCount(0)
  await expect(page.locator("aside").getByRole("link", { name: "Authworks", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Email address and verification", exact: true })).toBeVisible()

  await page.goto("/account/sessions")
  await expect(page.locator("main").getByText("Authworks", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible()
})

test("desktop sidebar collapse releases production content space", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/account")

  const content = page.locator("main").locator("..")
  await expect(content).toHaveCSS("margin-left", "288px")
  await page.getByRole("button", { name: "Close sidebar" }).click()
  await expect(page.locator("aside")).toHaveCount(0)
  await expect(content).toHaveCSS("margin-left", "0px")

  await page.getByRole("button", { name: "Open sidebar" }).click()
  await expect(page.locator("aside")).toHaveCount(1)
  await expect(content).toHaveCSS("margin-left", "288px")
})

test("representative production login, account, and administration views have no serious axe violations", async ({
  page,
}) => {
  for (const viewport of [
    { height: 720, width: 1280 },
    { height: 844, width: 390 },
  ]) {
    await page.setViewportSize(viewport)
    for (const path of ["/login/password", "/account/sessions", "/admin"]) {
      await page.goto(path)
      await expect(page.locator("main")).toBeVisible()
      const accessibility = await new AxeBuilder({ page }).analyze()
      expect(
        accessibility.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        ),
      ).toEqual([])
    }
  }
})
