import type { Page, Route } from "@playwright/test"
import { expect, test } from "@playwright/test"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"
const providerId = "018f0000-0000-7000-8000-000000000003"
const logoUrl = "https://assets.example.com/northwind-logo.svg"

const discovery = {
  branding: {
    dark: {
      backgroundColor: "#111827",
      fontColor: "#f9fafb",
      logoUrl,
      primaryColor: "#60a5fa",
      warnColor: "#f87171",
    },
    disableWatermark: true,
    legal: { privacyUrl: "https://acme.example/privacy", termsUrl: "https://acme.example/terms" },
    light: {
      backgroundColor: "#f8fafc",
      fontColor: "#111827",
      logoUrl,
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
    allowPassword: true,
    allowPasswordRecovery: true,
    allowPasskey: true,
    allowRegistration: true,
    providerIds: [providerId],
  },
  providers: [{ displayName: "GitHub", id: providerId, type: "github" }],
}

const authentication = { authenticatedAt: 1, realmId, userId: "user-1" }

type LoginRouteHandler = (route: Route, pathname: string) => Promise<unknown> | unknown

async function loginBackendMock(page: Page, handler: LoginRouteHandler) {
  const requests: { body: string; pathname: string }[] = []
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery|oauth2\/)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requests.push({ body: route.request().postData() ?? "", pathname })
    if (pathname === "/organization-discovery") return route.fulfill({ json: discovery })
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/sessions/recent")) return route.fulfill({ json: { items: [] } })
    return handler(route, pathname)
  })
  return requests
}

test("production sign-in discovers the realm at runtime and never hardcodes an identifier", async ({ page }) => {
  const requests = await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))

  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByText("Choose how you want to sign in to Northwind Labs.")).toBeVisible()
  expect(requests[0]?.pathname).toBe("/organization-discovery")
})

test("production login renders the discovered branding logo instead of the fallback", async ({ page }) => {
  await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))
  await page.route(logoUrl, (route) =>
    route.fulfill({ body: '<svg xmlns="http://www.w3.org/2000/svg" />', contentType: "image/svg+xml" }),
  )

  await page.goto("/login")

  await expect(page.locator("img.login-brand-logo")).toHaveAttribute("src", logoUrl)
  await expect(page.locator("svg.login-brand-logo")).toHaveCount(0)
})

test("a successful production password sign-in returns to a validated return path", async ({ page }) => {
  const requests = await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))

  await page.goto("/login/password?return_to=%2Faccount%2Fprofile")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("correct-horse")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/account\/profile$/)
  const login = requests.find((request) => request.pathname.endsWith("/password/login"))
  expect(login?.pathname).toBe(`/realms/${realmId}/password/login`)
  expect(JSON.parse(login?.body ?? "{}")).toMatchObject({ identifier: "alex@acme.example", organizationId })
})

test("an attacker-supplied return path is discarded in favour of the safe default", async ({ page }) => {
  await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))

  await page.goto("/login/password?return_to=https%3A%2F%2Fevil.example%2Fsteal")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("correct-horse")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/account$/)
})

test("a production sign-in failure is shown in place without disclosing the account", async ({ page }) => {
  await loginBackendMock(page, (route, pathname) =>
    pathname.endsWith("/password/login")
      ? route.fulfill({
          json: {
            error: {
              code: "passwords.unauthorized",
              message: "The identifier or password is incorrect.",
              op: "passwordLogin",
              status: 401,
            },
          },
          status: 401,
        })
      : route.fulfill({ json: {} }),
  )

  await page.goto("/login/password")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("wrong")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("alert")).toContainText("The identifier or password is incorrect.")
  await expect(page).toHaveURL(/\/login\/password$/)
})

test("a second-factor challenge advances the production sign-in to verification", async ({ page }) => {
  await loginBackendMock(page, (route, pathname) => {
    if (pathname.endsWith("/password/login"))
      return route.fulfill({
        json: {
          authentication,
          challenge: {
            challenge: { expiresAt: 2, id: "challenge-1", purpose: "login", requiredAssurance: "multi_factor" },
            token: "t".repeat(43),
          },
        },
      })
    return route.fulfill({ json: { authentication } })
  })

  await page.goto("/login/password")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("correct-horse")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/login\/mfa$/)
  await page.getByRole("button", { name: "Authenticator app" }).click()
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Verify", exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
})

test("an OIDC interaction resumes at the authorization endpoint with its opaque handle", async ({ page }) => {
  const handle = "a".repeat(43)
  const resumed: string[] = []
  await loginBackendMock(page, (route, pathname) => {
    if (pathname === "/oauth2/authorize") {
      resumed.push(route.request().url())
      return route.fulfill({ body: "resumed", contentType: "text/html" })
    }
    return route.fulfill({ json: { authentication } })
  })

  await page.goto(`/login/password?interaction=${handle}&return_to=%2Foauth2%2Fauthorize%3Finteraction%3D${handle}`)
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("correct-horse")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect.poll(() => resumed.length).toBeGreaterThan(0)
  expect(resumed[0]).toContain(`interaction=${handle}`)
})

test("a forged interaction handle is not forwarded to the authorization endpoint", async ({ page }) => {
  const resumed: string[] = []
  await loginBackendMock(page, (route, pathname) => {
    if (pathname === "/oauth2/authorize") {
      resumed.push(route.request().url())
      return route.fulfill({ body: "resumed", contentType: "text/html" })
    }
    return route.fulfill({ json: { authentication } })
  })

  await page.goto("/login/password?interaction=../../evil")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("correct-horse")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/account$/)
  expect(resumed).toEqual([])
})

test("production logout exchanges a CSRF token before revoking the session", async ({ page }) => {
  let logoutCsrf: string | undefined
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === "/organization-discovery") return route.fulfill({ json: discovery })
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/sessions/logout")) {
      logoutCsrf = route.request().headers()["x-csrf-token"]
      return route.fulfill({ json: { revoked: true } })
    }
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/login/logout")
  await page.getByRole("button", { name: "Sign out", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible()
  expect(logoutCsrf).toBe("csrf-e2e")
})

test("a failed realm discovery renders the unavailable state instead of a broken page", async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/organization-discovery/, (route) => route.fulfill({ json: { found: false } }))

  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Sign-in unavailable" })).toBeVisible()
})

test("production registration and recovery post to realm-scoped endpoints", async ({ page }) => {
  const requests = await loginBackendMock(page, (route, pathname) =>
    pathname.endsWith("/password/register")
      ? route.fulfill({ json: { accepted: true, verificationRequired: true } })
      : route.fulfill({ json: { accepted: true } }),
  )

  await page.goto("/login/register")
  await page.getByLabel("Full name").fill("Alex Stone")
  await page.getByLabel("Email address").fill("alex@acme.example")
  await page.getByLabel("Username").fill("alex")
  await page.getByLabel("New password").fill("correct-horse-battery")
  await page.getByLabel("Confirm password").fill("correct-horse-battery")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("heading", { name: "Confirm your email address" })).toBeVisible()

  await page.goto("/login/password/forgot")
  await page.getByLabel("Email address").fill("alex@acme.example")
  await page.getByRole("button", { name: "Send recovery instructions" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()

  expect(requests.map((request) => request.pathname)).toContain(`/realms/${realmId}/password/register`)
  expect(requests.map((request) => request.pathname)).toContain(`/realms/${realmId}/password/recovery/request`)
})

test("an external provider start redirects the browser to the provider authorization URL", async ({ page }) => {
  await loginBackendMock(page, (route, pathname) => {
    if (pathname.includes("/external-identity/"))
      return route.fulfill({
        json: {
          authorizationUrl: "https://github.example/login/oauth/authorize?client_id=fixture",
          expiresAt: 2,
          providerId,
        },
      })
    return route.fulfill({ json: {} })
  })
  await page.route(/^https:\/\/github\.example\//, (route) =>
    route.fulfill({ body: "provider", contentType: "text/html" }),
  )

  await page.goto("/login/idp")
  await expect(page.getByRole("heading", { name: "Continue with GitHub" })).toBeVisible()
  await page.getByRole("button", { name: "Continue with GitHub" }).click()

  await expect(page).toHaveURL(/github\.example/)
})

test("the registration entry point is hidden when the login policy forbids it", async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery)/, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === "/organization-discovery")
      return route.fulfill({ json: { ...discovery, policy: { ...discovery.policy, allowRegistration: false } } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Create an account" })).toBeHidden()
})
