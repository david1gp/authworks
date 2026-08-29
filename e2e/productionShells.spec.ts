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
    allowExternalIdentityAutoLinking: false,
    allowPassword: true,
    allowPasswordRecovery: true,
    allowPasskey: true,
    allowRegistration: true,
    allowedFactors: ["totp", "email_otp", "passkey"],
    minimumStepUpAssurance: "authenticated",
    preferredFactorOrder: ["totp", "email_otp", "passkey"],
    providerIds: [],
    requiredMfa: false,
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
        capabilities: { realmRead: true },
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
  await page.route(`**/realms/${realmId}/passkeys`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}/me/authentication-methods`, (route) =>
    route.fulfill({
      json: {
        emailOtp: { available: true },
        passkeys: { credentials: [] },
        recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
        totp: { enrolled: false, enrollments: [] },
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me/external-identities`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}/me/external-identity-providers`, (route) =>
    route.fulfill({ json: { items: [] } }),
  )
  await page.route(`**/realms/${realmId}/me/refresh-tokens`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}/me/security-history**`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}/me/effective-access`, (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/realms/${realmId}/me/consents`, (route) => route.fulfill({ json: { items: [] } }))
})

test("production focus and authenticated shells render without network adapters", async ({ page }) => {
  // `/login` now renders its own branded shell through the login feature adapter, so the shared
  // focus shell is exercised through `/consent` instead.
  await page.goto("/consent")
  await expect(page.getByRole("heading", { name: "Application consent", exact: true })).toBeVisible()
  await expect(page.locator('[data-shell="focus"]')).toBeVisible()
  await expect(page.locator('[data-content-state="empty"]')).toBeVisible()
  await expect(page.getByText("Production route placeholder")).toHaveCount(0)

  await page.goto("/account#devices-applications")
  const accountSection = page.locator("#devices-applications")
  await expect(
    accountSection.getByRole("heading", { name: /Sessions and devices.*Applications/, exact: true }),
  ).toBeVisible()
  const navigation = page.getByRole("navigation", { name: "Account navigation" })
  await expect(navigation).toBeVisible()
  for (const [label, href] of [
    ["Profile", "#profile"],
    ["Security", "#security"],
    ["Sessions and devices", "#devices-applications"],
    ["Access", "#access"],
    ["Danger zone", "#danger-zone"],
  ] as const) {
    const link = navigation.getByRole("link", { name: label, exact: true })
    await expect(link.locator("svg")).toHaveCount(1)
    await expect(link).toHaveAttribute("href", href)
  }
  await expect(page.locator("header").first()).toHaveCSS("position", "sticky")
  await expect(navigation).toHaveCSS("position", "sticky")
  // The product has a single realm, so the shell no longer renders a realm chooser. The organization
  // control only appears when the signed-in user actually belongs to more than one organization.
  await expect(page.getByLabel("Realm")).toHaveCount(0)
  await expect(page.locator('header select[aria-label="Organization"]')).toHaveCount(0)
  await expect(page.getByLabel("Language").locator("..").locator("svg")).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Sign out", exact: true }).locator("svg")).toHaveCount(1)

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

test("account workspace exposes sticky section navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/account")

  const navigation = page.getByRole("navigation", { name: "Account navigation" })
  await expect(navigation).toBeVisible()
  await expect(navigation).toHaveCSS("position", "sticky")
  await expect(navigation.getByRole("link", { name: "Profile", exact: true })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Danger zone", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open sidebar" })).toHaveCount(0)
})

test("account workspace keeps identity details consolidated and targets sections with anchors", async ({ page }) => {
  await page.goto("/account#profile")

  const profileSection = page.locator("#profile")
  const activeProfileLink = page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", {
    name: "Profile",
    exact: true,
  })

  await expect(activeProfileLink).toHaveAttribute("aria-current", "location")
  await expect(profileSection.getByRole("heading", { name: "Personal information", exact: true })).toBeVisible()
  const identityDetails = profileSection.getByText("customer-user", { exact: true }).locator("..")
  await expect(identityDetails.getByText("user@customer.example", { exact: true })).toBeVisible()
  await expect(page.getByText("Sign-in details", { exact: true })).toHaveCount(0)
  await expect(page.locator("aside")).toHaveCount(0)

  await page.goto("/account#devices-applications")
  await expect(
    page.locator("#devices-applications").getByRole("heading", { name: /Sessions and devices.*Applications/ }),
  ).toBeVisible()
})

test("account workspace uses full-width content without a contextual sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/account")

  const content = page.locator("main").locator("..")
  await expect(page.locator("aside")).toHaveCount(0)
  await expect(content).toHaveCSS("margin-left", "0px")
  await expect(page.getByRole("button", { name: "Close sidebar" })).toHaveCount(0)
  await expect(page.locator("header").first()).toHaveCSS("position", "sticky")
})

test("representative production login, account, and administration views have no serious axe violations", async ({
  page,
}) => {
  for (const viewport of [
    { height: 720, width: 1280 },
    { height: 844, width: 390 },
  ]) {
    await page.setViewportSize(viewport)
    for (const path of ["/login/password", "/account", "/admin"]) {
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
