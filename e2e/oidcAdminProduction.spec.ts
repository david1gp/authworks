import { expect, test } from "@playwright/test"

// The shell's default session realm, used only to scope request interception.
const realmSlug = "customer-identity"
// Payloads must satisfy the public UUIDv7-shaped resource identifier schema.
const realmId = "018f0000-0000-7000-8000-000000000001"
const clientId = "018f0000-0000-7000-8000-000000000041"
const userId = "018f0000-0000-7000-8000-000000000021"
const keyId = "018f0000-0000-7000-8000-000000000061"

const client = {
  allowedScopes: ["openid", "profile", "email"],
  clientType: "confidential",
  createdAt: 1,
  id: clientId,
  name: "Acme Web Portal",
  postLogoutRedirectUris: [],
  realmId,
  redirectUris: ["https://portal.acme.example/callback"],
  requireConsent: true,
  status: "active",
  trusted: false,
  updatedAt: 1,
}
const signingKey = {
  algorithm: "RS256",
  createdAt: 1,
  id: keyId,
  publicJwk: { alg: "RS256", e: "AQAB", kid: keyId, kty: "RSA", n: "modulus", use: "sig" },
  realmId,
  retiredAt: null,
  status: "active",
}
const user = {
  createdAt: 1,
  email: "alex.morgan@northwind.example",
  emailVerified: true,
  id: userId,
  profile: { displayName: "Alex Morgan", firstName: "Alex", lastName: "Morgan" },
  realmId,
  state: "active",
  updatedAt: 1,
  userName: "alex.morgan",
  verificationState: "verified",
}

test("the production client list reads the realm-scoped tenant API", async ({ page }) => {
  const requested: string[] = []
  await page.route(`**/realms/${realmSlug}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requested.push(pathname)
    if (pathname.endsWith("/oidc/clients")) return route.fulfill({ json: { items: [client] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/oidc-clients")

  await expect(page.getByText("Acme Web Portal", { exact: true })).toBeVisible()
  await expect(page.getByText("https://portal.acme.example/callback", { exact: true })).toBeVisible()
  expect(requested).toContain(`/realms/${realmSlug}/oidc/clients`)
  // The browser must never reach the operator-only system surface.
  expect(requested.every((pathname) => !pathname.startsWith("/system/"))).toBe(true)
})

test("registering a client sends a CSRF-protected mutation and shows the secret once", async ({ page }) => {
  let createHadCsrf = false
  await page.route(`**/realms/${realmSlug}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/oidc/clients") && request.method() === "POST") {
      createHadCsrf = request.headers()["x-csrf-token"] !== undefined
      return route.fulfill({
        json: { client: { ...client, name: "Production Client" }, clientSecret: "p".repeat(43) },
      })
    }
    if (pathname.endsWith("/oidc/clients")) return route.fulfill({ json: { items: [client] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/oidc-clients")
  await expect(page.getByText("Acme Web Portal", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Register client", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Client name", { exact: true }).fill("Production Client")
  await dialog.getByLabel("Redirect URIs", { exact: true }).fill("https://portal.acme.example/callback")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='oidc-client']")
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-secret-value]")).toContainText("p".repeat(43))
  expect(createHadCsrf).toBe(true)
})

test("rotating a client secret posts to the dedicated path and never re-reads the value", async ({ page }) => {
  let rotateHadCsrf = false
  await page.route(`**/realms/${realmSlug}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/secret/rotate")) {
      rotateHadCsrf = request.headers()["x-csrf-token"] !== undefined
      return route.fulfill({ json: { client, clientSecret: "r".repeat(43) } })
    }
    if (pathname.endsWith(`/oidc/clients/${clientId}`)) return route.fulfill({ json: { client } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/oidc-clients/${clientId}`)
  // The stored secret is only ever presented as redacted before rotation.
  await expect(page.locator("[data-secret-redacted]")).toBeVisible()

  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Rotate secret", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='oidc-client']")
  await expect(panel.locator("[data-secret-value]")).toContainText("r".repeat(43))
  expect(rotateHadCsrf).toBe(true)
})

test("signing key rotation is confirmed before the mutation is sent", async ({ page }) => {
  let rotateRequested = false
  await page.route(`**/realms/${realmSlug}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/signing-keys/rotate")) {
      rotateRequested = true
      return route.fulfill({ json: { signingKey } })
    }
    if (pathname.endsWith("/oidc/signing-keys")) return route.fulfill({ json: { items: [signingKey] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/signing-keys")
  await expect(page.getByText(keyId, { exact: true })).toBeVisible()

  // A dismissed confirmation must not send the destructive mutation.
  page.once("dialog", (dialog) => void dialog.dismiss())
  await page.getByRole("button", { name: "Rotate key", exact: true }).click()
  await expect(page.getByRole("status")).toHaveCount(0)
  expect(rotateRequested).toBe(false)

  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Rotate key", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("rotated")
  expect(rotateRequested).toBe(true)
})

test("consent revocation posts to the subject's tenant path", async ({ page }) => {
  let revokeRequested = false
  await page.route(`**/realms/${realmSlug}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/revoke")) {
      revokeRequested = pathname.includes(`/oidc/consents/${userId}/${clientId}`)
      return route.fulfill({ json: { revoked: true } })
    }
    if (pathname.endsWith("/users")) return route.fulfill({ json: { items: [user] } })
    if (pathname.endsWith("/oidc/clients")) return route.fulfill({ json: { items: [client] } })
    if (pathname.includes("/oidc/consents/"))
      return route.fulfill({
        json: {
          items: [{ clientId, createdAt: 1, realmId, scope: ["openid", "profile"], updatedAt: 1, userId }],
        },
      })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/oidc-consents")
  await expect(page.getByText("Acme Web Portal", { exact: true })).toBeVisible()

  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Revoke", exact: true }).click()

  await expect(page.getByRole("status")).toContainText("revoked")
  expect(revokeRequested).toBe(true)
})

test("protocol documents read the well-known endpoints and stay read-only", async ({ page }) => {
  await page.route("**/.well-known/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("jwks.json")) return route.fulfill({ json: { keys: [signingKey.publicJwk] } })
    return route.fulfill({
      json: {
        authorization_endpoint: "https://auth.example/oauth/v2/authorize",
        claims_supported: ["sub"],
        code_challenge_methods_supported: ["S256"],
        end_session_endpoint: "https://auth.example/oidc/v1/end_session",
        grant_types_supported: ["authorization_code"],
        id_token_signing_alg_values_supported: ["RS256"],
        issuer: "https://auth.example",
        jwks_uri: "https://auth.example/.well-known/jwks.json",
        response_types_supported: ["code"],
        revocation_endpoint: "https://auth.example/oauth/v2/revoke",
        revocation_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["openid"],
        subject_types_supported: ["public"],
        token_endpoint: "https://auth.example/oauth/v2/token",
        token_endpoint_auth_methods_supported: ["none"],
        userinfo_endpoint: "https://auth.example/oidc/v1/userinfo",
      },
    })
  })

  await page.goto("/admin/protocol-documents")

  await expect(page.getByText("https://auth.example", { exact: true }).first()).toBeVisible()
  await expect(page.locator("[data-read-only-notice]")).toBeVisible()
  await expect(page.getByRole("button", { name: /save|delete|remove|rotate/i })).toHaveCount(0)
})

test("permission, assurance, and tenant failures render distinct inaccessible states", async ({ page }) => {
  await page.route(`**/realms/${realmSlug}/**`, async (route) =>
    route.fulfill({
      json: { error: { code: "oidc.forbidden", message: "Denied.", op: "oidcClientList", status: 403 } },
      status: 403,
    }),
  )
  await page.goto("/admin/oidc-clients")
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("permission")

  await page.route(`**/realms/${realmSlug}/**`, async (route) =>
    route.fulfill({
      json: {
        error: { code: "sessions.assurance-required", message: "Step up.", op: "oidcClientGet", status: 403 },
      },
      status: 403,
    }),
  )
  await page.goto(`/admin/oidc-clients/${clientId}`)
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("stronger")

  await page.route(`**/realms/${realmSlug}/**`, async (route) =>
    route.fulfill({
      json: { error: { code: "oidc.tenant-mismatch", message: "Other realm.", op: "oidcClientGet", status: 404 } },
      status: 404,
    }),
  )
  await page.goto(`/admin/oidc-clients/${clientId}`)
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("different realm")
})
