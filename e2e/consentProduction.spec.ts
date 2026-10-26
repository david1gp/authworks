import type { Page, Route } from "@playwright/test"
import { expect } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"
const providerId = "018f0000-0000-7000-8000-000000000003"
const handle = "a".repeat(43)

const discovery = {
  branding: {
    dark: {
      backgroundColor: "#111827",
      fontColor: "#f9fafb",
      logoUrl: "https://assets.example.com/northwind-logo.svg",
      primaryColor: "#60a5fa",
      warnColor: "#f87171",
    },
    disableWatermark: true,
    legal: { privacyUrl: "https://acme.example/privacy", termsUrl: "https://acme.example/terms" },
    light: {
      backgroundColor: "#f8fafb",
      fontColor: "#111827",
      logoUrl: "https://assets.example.com/northwind-logo.svg",
      primaryColor: "#2563eb",
      warnColor: "#dc2626",
    },
    themeMode: "system",
  },
  domain: "acme.example",
  found: true,
  organization: { id: organizationId, name: "Northwind Labs", realmId },
  policy: {
    allowDomainDiscovery: true,
    allowEmailOtp: true,
    allowExternalIdentity: true,
    allowExternalIdentityAutoLinking: true,
    allowPassword: true,
    allowPasswordRecovery: true,
    allowPasskey: true,
    allowRegistration: true,
    allowedFactors: ["totp", "email_otp", "passkey"],
    minimumStepUpAssurance: "authenticated",
    preferredFactorOrder: ["totp", "email_otp", "passkey"],
    providerIds: [providerId],
    requiredMfa: false,
    mfaInitSkipLifetimeSeconds: null,
    secondFactorCheckLifetimeSeconds: null,
    multiFactorCheckLifetimeSeconds: null,
    forceMfaLocalOnly: false,
  },
  providers: [{ displayName: "GitHub", id: providerId, type: "github" }],
}

const details = {
  client_id: "018f0000-0000-7000-8000-000000000004",
  client_name: "Example app",
  realm_id: realmId,
  redirect_uri: "https://client.example/callback",
  scopes: ["openid", "profile", "mystery-scope"],
}

type ConsentRouteHandler = (route: Route, pathname: string) => Promise<unknown> | unknown

async function consentBackendMock(page: Page, handler: ConsentRouteHandler, interactionStatus = 200) {
  const requests: { body: string; pathname: string }[] = []
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery|oauth2\/)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requests.push({ body: route.request().postData() ?? "", pathname })
    if (pathname === "/organization-discovery") return route.fulfill({ json: discovery })
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/sessions/recent")) return route.fulfill({ json: { items: [] } })
    if (pathname === "/oauth2/interaction")
      return interactionStatus === 200
        ? route.fulfill({ json: details })
        : route.fulfill({ json: {}, status: interactionStatus })
    return handler(route, pathname)
  })
  return requests
}

async function consentRedirectMock(page: Page, decision: "approve" | "deny", state: string) {
  return consentBackendMock(page, (route, pathname) => {
    if (pathname !== "/oauth2/consent") return route.fulfill({ json: {} })
    const origin = new URL(route.request().url()).origin
    const redirect =
      decision === "approve"
        ? `${origin}/rp/callback?code=code-e2e&state=${state}`
        : `${origin}/rp/callback?error=access_denied&state=${state}`
    return route.fulfill({ json: { redirect } })
  })
}

test("production consent approves on /login/consent and follows the RP redirect", async ({ page }) => {
  const requests = await consentRedirectMock(page, "approve", "consent-e2e")
  await page.goto(`/login/consent?interaction=${handle}`)

  await expect(page.getByRole("heading", { name: "Example app" })).toBeVisible()
  await expect(page.getByText("Verify your identity")).toBeVisible()
  await expect(page.getByText("mystery-scope")).toBeVisible()

  await page.getByRole("button", { name: "Approve" }).click()
  await page.waitForURL((url) => url.searchParams.get("code") === "code-e2e")
  expect(page.url()).toContain("/rp/callback")
  expect(requests.map((request) => request.pathname)).toContain("/oauth2/consent")
  const consent = requests.find((request) => request.pathname === "/oauth2/consent")
  expect(consent?.body).toContain('"decision":"approve"')
})

test("production consent denies on /login/consent and follows the access-denied redirect", async ({ page }) => {
  await consentRedirectMock(page, "deny", "deny-e2e")
  await page.goto(`/login/consent?interaction=${handle}`)

  await expect(page.getByRole("heading", { name: "Example app" })).toBeVisible()
  await page.getByRole("button", { name: "Deny" }).click()
  await page.waitForURL((url) => url.searchParams.get("error") === "access_denied")
  expect(page.url()).toContain("state=deny-e2e")
})

test("production consent routes an unauthenticated visit to sign-in preserving the interaction", async ({ page }) => {
  await consentBackendMock(page, (route) => route.fulfill({ json: {} }))
  await page.goto(`/consent?interaction=${handle}`)

  await expect(page).toHaveURL(new RegExp(`/login\\?return_to=${encodeURIComponent(`/consent?interaction=${handle}`)}`))
})

test("production consent shows the expired panel with a sign-in link for invalid interactions", async ({ page }) => {
  await consentBackendMock(
    page,
    (route, pathname) => (pathname === "/oauth2/consent" ? route.fulfill({ json: {} }) : route.fulfill({ json: {} })),
    400,
  )
  await page.goto(`/login/consent?interaction=${handle}`)

  await expect(page.getByRole("heading", { name: "Authorization request expired" })).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(new RegExp(`/login\\?interaction=${handle}$`))
})

test("production consent shows the missing panel without fetching when the handle is absent", async ({ page }) => {
  const requests = await consentBackendMock(page, (route) => route.fulfill({ json: {} }))
  await page.goto("/login/consent")

  await expect(page.getByRole("heading", { name: "No authorization request" })).toBeVisible()
  expect(requests.map((request) => request.pathname)).not.toContain("/oauth2/interaction")
})
