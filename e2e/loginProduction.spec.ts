import type { Page, Route } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { sessionBrowserModeHeaderName } from "../src/features/sessions/public/sessionBrowserModeHeaderName.js"

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
const whatsappDiscovery = {
  ...discovery,
  policy: { ...discovery.policy, allowWhatsappOtp: true },
}

type LoginRouteHandler = (route: Route, pathname: string) => Promise<unknown> | unknown

async function loginBackendMock(page: Page, handler: LoginRouteHandler, discovered = discovery) {
  const requests: { body: string; headers: Record<string, string>; pathname: string }[] = []
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery|oauth2\/)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requests.push({ body: route.request().postData() ?? "", headers: route.request().headers(), pathname })
    if (pathname === "/organization-discovery") return route.fulfill({ json: discovered })
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/sessions/recent")) return route.fulfill({ json: { items: [] } })
    return handler(route, pathname)
  })
  return requests
}

test("production sign-in discovers the realm at runtime and never hardcodes an identifier", async ({ page }) => {
  const requests = await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))

  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Choose a method" })).toBeVisible()
  expect(requests[0]?.pathname).toBe("/organization-discovery")
})

test("production chooser shows WhatsApp only when policy and availability allow it", async ({ page }) => {
  const requests = await loginBackendMock(
    page,
    (route, pathname) =>
      pathname.endsWith("/whatsapp-otp/availability")
        ? route.fulfill({ json: { available: true } })
        : route.fulfill({ json: { authentication } }),
    whatsappDiscovery,
  )

  await page.goto("/login")

  await expect(page.getByRole("button", { name: /WhatsApp code/ })).toBeVisible()
  await expect(page.getByText("Receive a one-time code on WhatsApp")).toBeVisible()
  expect(requests.map((request) => request.pathname)).toContain(`/realms/${realmId}/whatsapp-otp/availability`)
})

test("production chooser omits WhatsApp when production availability is unhealthy", async ({ page }) => {
  await loginBackendMock(
    page,
    (route, pathname) =>
      pathname.endsWith("/whatsapp-otp/availability")
        ? route.fulfill({ json: { available: false } })
        : route.fulfill({ json: { authentication } }),
    whatsappDiscovery,
  )

  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Choose a method" })).toBeVisible()
  await expect(page.getByRole("button", { name: /WhatsApp code/ })).toHaveCount(0)
})

test("production direct WhatsApp routes return to the chooser when policy disables WhatsApp", async ({ page }) => {
  await loginBackendMock(page, (route) => route.fulfill({ json: { authentication } }))

  for (const path of ["/login/whatsapp-otp", "/login/whatsapp-otp/code"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login\/chooser$/)
    await expect(page.getByRole("heading", { name: "Choose a method" })).toBeVisible()
  }
})

test("production browser-history WhatsApp entries refresh availability for outage and recovery", async ({ page }) => {
  let availabilityCalls = 0
  await loginBackendMock(
    page,
    (route, pathname) => {
      if (pathname.endsWith("/whatsapp-otp/availability")) {
        availabilityCalls += 1
        return route.fulfill({ json: { available: availabilityCalls !== 2 } })
      }
      return route.fulfill({ json: { authentication } })
    },
    whatsappDiscovery,
  )

  await page.goto("/login/chooser")
  await expect(page.getByRole("button", { name: /WhatsApp code/ })).toBeVisible()
  await page.getByRole("button", { name: /WhatsApp code/ }).click()
  await expect(page).toHaveURL(/\/login\/whatsapp-otp$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/login\/chooser$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/login\/chooser$/)
  expect(availabilityCalls).toBe(2)

  await page.goBack()
  await expect(page).toHaveURL(/\/login\/whatsapp-otp$/)
  await expect.poll(() => availabilityCalls).toBe(3)
  await expect(page.getByRole("heading", { name: "Sign in with WhatsApp" })).toBeVisible()
})

test("a production WhatsApp sign-in starts, resends, verifies, and continues authenticated", async ({ page }) => {
  const requests = await loginBackendMock(
    page,
    (route, pathname) => {
      if (pathname.endsWith("/whatsapp-otp/availability")) return route.fulfill({ json: { available: true } })
      if (pathname.endsWith("/whatsapp-otp/start"))
        return route.fulfill({
          json: { accepted: true, challengeId: "wa-challenge-1", expiresAt: 600_000, retryAt: 0 },
        })
      if (pathname.endsWith("/whatsapp-otp/resend"))
        return route.fulfill({
          json: { accepted: true, challengeId: "wa-challenge-2", expiresAt: 600_000, retryAt: 0 },
        })
      if (pathname.endsWith("/whatsapp-otp/verify"))
        return route.fulfill({
          headers: { "set-cookie": "session=e2e-session; Path=/; HttpOnly; Secure; SameSite=Lax" },
          json: { authentication },
        })
      return route.fulfill({ json: { authentication } })
    },
    whatsappDiscovery,
  )

  await page.goto("/login/whatsapp-otp")
  await expect(page.getByRole("heading", { name: "Sign in with WhatsApp" })).toBeVisible()
  await page.getByLabel("WhatsApp phone number").fill("+15551234567")
  await page.getByRole("button", { name: "Send WhatsApp code", exact: true }).click()

  await expect(page.getByRole("heading", { name: "WhatsApp verification code" })).toBeVisible()
  await expect(page.getByText("Enter the code sent to +15551234567 on WhatsApp.", { exact: true })).toBeVisible()
  const start = requests.find((request) => request.pathname.endsWith("/whatsapp-otp/start"))
  expect(JSON.parse(start?.body ?? "{}")).toMatchObject({ organizationId, phoneNumber: "+15551234567" })

  await page.getByRole("button", { name: "Resend code", exact: true }).click()
  await expect
    .poll(() => requests.filter((request) => request.pathname.endsWith("/whatsapp-otp/resend")).length)
    .toBe(1)

  await page.locator("#whatsapp-otp-code").fill("123456")
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page).toHaveURL(/\/account$/)
  const verify = requests.find((request) => request.pathname.endsWith("/whatsapp-otp/verify"))
  expect(JSON.parse(verify?.body ?? "{}")).toMatchObject({
    challengeId: "wa-challenge-2",
    code: "123456",
    organizationId,
  })
  for (const path of ["/whatsapp-otp/start", "/whatsapp-otp/resend", "/whatsapp-otp/verify"]) {
    const request = requests.find((candidate) => candidate.pathname.endsWith(path))
    expect(request?.headers[sessionBrowserModeHeaderName]).toBe("true")
    expect(request?.headers.authorization).toBeUndefined()
  }
  const sessionCookie = (await page.context().cookies()).find((cookie) => cookie.name === "session")
  expect(sessionCookie?.value).toBe("e2e-session")
  expect(sessionCookie?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain("session=")
})

test("production WhatsApp errors remain inline during phone start and code verification", async ({ page }) => {
  let startAttempts = 0
  await loginBackendMock(
    page,
    (route, pathname) => {
      if (pathname.endsWith("/whatsapp-otp/availability")) return route.fulfill({ json: { available: true } })
      if (pathname.endsWith("/whatsapp-otp/start")) {
        startAttempts += 1
        return startAttempts === 1
          ? route.fulfill({
              json: {
                error: {
                  code: "whatsapp-otp.invalid",
                  message: "The WhatsApp code could not be sent.",
                  op: "whatsappOtpStart",
                  status: 422,
                },
              },
              status: 422,
            })
          : route.fulfill({ json: { accepted: true, challengeId: "wa-challenge", expiresAt: 600_000, retryAt: 0 } })
      }
      if (pathname.endsWith("/whatsapp-otp/verify"))
        return route.fulfill({
          json: {
            error: {
              code: "whatsapp-otp.invalid",
              message: "The WhatsApp code is incorrect.",
              op: "whatsappOtpVerify",
              status: 401,
            },
          },
          status: 401,
        })
      return route.fulfill({ json: { authentication } })
    },
    whatsappDiscovery,
  )

  await page.goto("/login/whatsapp-otp")
  await page.getByLabel("WhatsApp phone number").fill("+15551234567")
  await page.getByRole("button", { name: "Send WhatsApp code", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("The WhatsApp code could not be sent.")
  await expect(page.getByRole("heading", { name: "Sign in with WhatsApp" })).toBeVisible()

  await page.getByRole("button", { name: "Send WhatsApp code", exact: true }).click()
  await page.locator("#whatsapp-otp-code").fill("000000")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("The WhatsApp code is incorrect.")
  await expect(page.getByRole("heading", { name: "WhatsApp verification code" })).toBeVisible()
})

test("a production WhatsApp authentication can continue through MFA", async ({ page }) => {
  const requests = await loginBackendMock(
    page,
    (route, pathname) => {
      if (pathname.endsWith("/whatsapp-otp/availability")) return route.fulfill({ json: { available: true } })
      if (pathname.endsWith("/whatsapp-otp/start"))
        return route.fulfill({ json: { accepted: true, challengeId: "wa-challenge", expiresAt: 600_000, retryAt: 0 } })
      if (pathname.endsWith("/whatsapp-otp/verify"))
        return route.fulfill({
          json: {
            authentication,
            challenge: {
              challenge: {
                expiresAt: 600_000,
                id: "mfa-challenge",
                purpose: "login",
                requiredAssurance: "multi_factor",
              },
              token: "t".repeat(43),
            },
          },
        })
      if (pathname.endsWith("/mfa/challenge/complete")) return route.fulfill({ json: { authentication } })
      return route.fulfill({ json: { authentication } })
    },
    whatsappDiscovery,
  )

  await page.goto("/login/whatsapp-otp")
  await page.getByLabel("WhatsApp phone number").fill("+15551234567")
  await page.getByRole("button", { name: "Send WhatsApp code", exact: true }).click()
  await page.locator("#whatsapp-otp-code").fill("123456")
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page).toHaveURL(/\/login\/mfa$/)
  await page.getByRole("button", { name: "Authenticator app" }).click()
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Verify", exact: true }).click()

  await expect(page).toHaveURL(/\/account$/)
  expect(requests.some((request) => request.pathname.endsWith("/mfa/challenge/complete"))).toBe(true)
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

  await expect(page.getByRole("heading", { name: "Start sign-in again" })).toBeVisible()
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
  await page.getByRole("button", { name: "Send reset link", exact: true }).click()
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
  await expect(page.getByRole("heading", { name: "Sign in with GitHub" })).toBeVisible()
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

  await expect(page.getByRole("heading", { name: "Choose a method" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Create an account" })).toBeHidden()
})
