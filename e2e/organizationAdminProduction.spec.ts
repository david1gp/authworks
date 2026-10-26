import type { Page, Route } from "@playwright/test"
import { expect } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"
import { productionAdminSessionBootstrap } from "./productionAdminSessionBootstrap.js"

// Payloads must satisfy the public UUIDv7-shaped resource identifier schema.
const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"
const organizationName = "Northwind Labs"
const userId = "018f0000-0000-7000-8000-000000000021"
const membershipId = "018f0000-0000-7000-8000-000000000022"
const invitationId = "018f0000-0000-7000-8000-000000000023"
const clientId = "018f0000-0000-7000-8000-000000000041"
const projectId = "018f0000-0000-7000-8000-000000000051"
const sessionId = "018f0000-0000-7000-8000-000000000061"
const realmApiPath = new RegExp(`/realms/${realmId}/(?!sessions/current(?:\\?|$))`)

const policy = {
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
  providerIds: [],
  requiredMfa: false,
  mfaInitSkipLifetimeSeconds: null,
  secondFactorCheckLifetimeSeconds: null,
  multiFactorCheckLifetimeSeconds: null,
  forceMfaLocalOnly: false,
}

const organization = {
  createdAt: 1_700_000_000_000,
  id: organizationId,
  name: organizationName,
  realmId,
  status: "active",
  updatedAt: 1_700_000_100_000,
}

const branding = {
  branding: {
    dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
    disableWatermark: true,
    light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
    themeMode: "system",
  },
  organizationId,
  updatedAt: 1_700_000_100_000,
  version: 1,
}

const loginPolicyResponse = {
  organizationId,
  overrides: {},
  policy,
  realmId,
}

const membership = {
  createdAt: 1_700_000_000_000,
  id: membershipId,
  organizationId,
  realmId,
  roles: ["member"],
  updatedAt: 1_700_000_000_000,
  userId,
}

const invitation = {
  acceptedAt: null,
  createdAt: 1_700_000_000_000,
  email: "invited@example.com",
  expiresAt: 1_800_000_000_000,
  id: invitationId,
  organizationId,
  realmId,
  roles: ["member"],
  status: "pending",
  updatedAt: 1_700_000_000_000,
}

const domain = {
  createdAt: 1_700_000_000_000,
  domain: "login.example.com",
  isPrimary: false,
  organizationId,
  realmId,
  updatedAt: 1_700_000_000_000,
  verification: {
    recordName: "_authworks-verification.login.example.com",
    recordType: "TXT",
    recordValue: "verification-token-value-00",
  },
  verified: false,
  version: 1,
}

const directoryEntry = {
  memberships: [
    {
      createdAt: 1_700_000_000_000,
      membershipId,
      organizationId,
      organizationName,
      roles: ["member"],
    },
  ],
  user: {
    createdAt: 1_700_000_000_000,
    displayName: "Alex Morgan",
    email: "alex.morgan@northwind.example",
    emailVerified: true,
    id: userId,
    lastSignInAt: 1_700_000_050_000,
    state: "active",
    userName: "alex.morgan",
    verificationState: "verified",
  },
}

const adminSession = {
  assurance: "authenticated",
  authenticationMethod: "password",
  createdAt: 1_700_000_000_000,
  current: false,
  device: {},
  expiresAt: 1_700_000_900_000,
  id: sessionId,
  lastUsedAt: 1_700_000_050_000,
  realmId,
  revokedAt: null,
  subjectId: userId,
  subjectType: "user",
  userId,
}

const client = {
  accessTokenLifetimeSeconds: null,
  accessTokenRoleAssertion: false,
  additionalOrigins: [],
  allowedScopes: ["openid", "profile", "email", "offline_access"],
  clientType: "confidential",
  createdAt: 1,
  devMode: false,
  grantTypes: ["authorization_code", "refresh_token"],
  id: clientId,
  idTokenLifetimeSeconds: null,
  idTokenRoleAssertion: false,
  idTokenUserinfoAssertion: false,
  name: "Acme Web Portal",
  postLogoutRedirectUris: ["https://portal.acme.example/signed-out"],
  realmId,
  redirectUris: ["https://portal.acme.example/callback"],
  refreshTokenAbsoluteLifetimeSeconds: null,
  refreshTokenIdleLifetimeSeconds: null,
  requireConsent: true,
  responseTypes: ["code"],
  status: "active",
  trusted: false,
  updatedAt: 1,
}

const project = {
  applicationCount: 0,
  authorizationRequired: false,
  createdAt: 1,
  id: projectId,
  name: "Portal Project",
  organizationId,
  projectAccessRequired: false,
  realmId,
  roleCount: 0,
  status: "active",
  updatedAt: 1,
}

test.beforeEach(async ({ page }) => {
  await productionAdminSessionBootstrap(page, { organizationId, organizationName, realmId })
  await page.route(`**/realms/${realmId}/me/organizations`, (route) =>
    route.fulfill({
      json: {
        items: [{ membership: { ...membership, roles: ["owner"] }, organization }],
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me`, (route) =>
    route.fulfill({
      json: {
        capabilities: { realmAdministrator: true, realmRead: true },
        user: {
          createdAt: 1_700_000_000_000,
          email: "admin@customer.example",
          emailVerified: true,
          id: "01900000-0000-7000-8000-0000000000b1",
          profile: { displayName: "Customer admin" },
          realmId,
          state: "active",
          updatedAt: 1_700_000_000_000,
          userName: "customer-admin",
          verificationState: "verified",
        },
      },
    }),
  )
})

async function realmBackendMock(page: Page, handler: (route: Route, pathname: string) => Promise<unknown>) {
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    return handler(route, pathname)
  })
}

test("verifying a tenant domain posts to the dedicated path with CSRF", async ({ page }) => {
  const requested: { csrf: boolean; method: string; pathname: string }[] = []
  await realmBackendMock(page, async (route, pathname) => {
    requested.push({
      csrf: route.request().headers()["x-csrf-token"] === "csrf-e2e",
      method: route.request().method(),
      pathname,
    })
    if (pathname.endsWith(`/organizations/${organizationId}`)) return route.fulfill({ json: { organization } })
    if (pathname.endsWith(`/organizations/${organizationId}/branding`)) return route.fulfill({ json: branding })
    if (pathname.endsWith(`/organizations/${organizationId}/login-policy`))
      return route.fulfill({ json: loginPolicyResponse })
    if (pathname.endsWith(`/organizations/${organizationId}/domains`))
      return route.fulfill({ json: { items: [domain] } })
    if (pathname.endsWith(`/domains/${domain.domain}/verify`))
      return route.fulfill({ json: { domain: { ...domain, verified: true } } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/configuration/domains")

  await expect(page.getByText(domain.domain, { exact: true })).toBeVisible()
  const verifyResponse = page.waitForResponse(
    (response) => response.url().includes(`/domains/${domain.domain}/verify`) && response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Verify domain", exact: true }).click()
  await verifyResponse

  const verify = requested.find((entry) => entry.pathname.endsWith("/verify"))
  expect(verify?.method).toBe("POST")
  expect(verify?.csrf).toBe(true)
})

test("revoking an organization invitation posts to the tenant revoke path", async ({ page }) => {
  let revokeHadCsrf = false
  await realmBackendMock(page, async (route, pathname) => {
    if (pathname.endsWith("/directory/users")) return route.fulfill({ json: { items: [directoryEntry] } })
    if (pathname.endsWith(`/organizations/${organizationId}/users/summary`))
      return route.fulfill({ json: { roles: { admin: 0, guest: 0, member: 1, owner: 1 }, total: 2 } })
    if (pathname.endsWith(`/organizations/${organizationId}/invitations`))
      return route.fulfill({ json: { items: [invitation] } })
    if (pathname.endsWith(`/invitations/${invitationId}/revoke`)) {
      revokeHadCsrf = route.request().headers()["x-csrf-token"] === "csrf-e2e"
      return route.fulfill({ json: { revoked: true } })
    }
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/users?tab=invitations")

  await expect(page.getByText("1 invitation", { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("table").getByText(invitation.email, { exact: true })).toBeVisible()
  const revokeResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/invitations/${invitationId}/revoke`) && response.request().method() === "POST",
  )
  await page.getByRole("table").getByRole("button", { name: "Revoke invitation", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(confirmation).toBeHidden({ timeout: 10_000 })
  await revokeResponse

  expect(revokeHadCsrf).toBe(true)
})

test("revoking an administrator session deletes the user session path", async ({ page }) => {
  let revoke: { csrf: boolean; method: string; pathname: string } | undefined
  await realmBackendMock(page, async (route, pathname) => {
    if (pathname === `/realms/${realmId}/sessions`) return route.fulfill({ json: { items: [adminSession] } })
    if (pathname === `/realms/${realmId}/users/${userId}/sessions/${sessionId}`) {
      revoke = {
        csrf: route.request().headers()["x-csrf-token"] === "csrf-e2e",
        method: route.request().method(),
        pathname,
      }
      return route.fulfill({ json: { revoked: true } })
    }
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/sessions")

  await expect(page.getByText(sessionId, { exact: true }).first()).toBeVisible()
  const revokeResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/users/${userId}/sessions/${sessionId}`) && response.request().method() === "DELETE",
  )
  await page.getByRole("listitem").getByRole("button", { name: "Revoke", exact: true }).first().click()
  const sessionConfirmation = page.getByRole("alertdialog")
  await expect(sessionConfirmation).toBeVisible()
  await sessionConfirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await revokeResponse

  expect(revoke?.method).toBe("DELETE")
  expect(revoke?.csrf).toBe(true)
})

test("saving the login policy persists the session lifetime with CSRF", async ({ page }) => {
  let savedBody = ""
  await realmBackendMock(page, async (route, pathname) => {
    if (
      pathname.endsWith(`/organizations/${organizationId}/login-policy`) ||
      pathname === `/realms/${realmId}/login-policy`
    ) {
      if (route.request().method() === "PATCH") {
        savedBody = route.request().postData() ?? ""
        return route.fulfill({
          json: {
            organizationId: null,
            overrides: {},
            policy: { ...policy, sessionLifetimeSeconds: 3600 },
            realmId,
          },
        })
      }
      return route.fulfill({ json: { organizationId: null, overrides: {}, policy, realmId } })
    }
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/login-policy")

  const lifetime = page.locator("#policy-session-lifetime")
  await expect(lifetime).toBeVisible()
  await lifetime.fill("3600")
  const policyResponse = page.waitForResponse(
    (response) => response.url().endsWith("/login-policy") && response.request().method() === "PATCH",
  )
  await page.getByRole("button", { name: "Save", exact: true }).first().click()
  await policyResponse

  expect(savedBody).toContain("3600")
})

test("editing an OIDC client persists redirect URIs and the project link", async ({ page }) => {
  let savedBody = ""
  await realmBackendMock(page, async (route, pathname) => {
    if (pathname.endsWith(`/oidc/clients/${clientId}`)) {
      if (route.request().method() === "PATCH") {
        savedBody = route.request().postData() ?? ""
        return route.fulfill({ json: { client } })
      }
      return route.fulfill({ json: { client } })
    }
    if (pathname.endsWith(`/realms/${realmId}/projects`)) return route.fulfill({ json: { items: [project] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/oidc-clients/${clientId}`)

  const redirects = page.locator("#oidc-detail-redirects")
  await expect(redirects).toBeVisible()
  await redirects.fill("https://portal.acme.example/callback\nhttps://portal.acme.example/silent")
  await page.locator("#oidc-detail-project").selectOption(projectId)
  const updateResponse = page.waitForResponse(
    (response) => response.url().includes(`/oidc/clients/${clientId}`) && response.request().method() === "PATCH",
  )
  await page.getByRole("button", { name: "Save", exact: true }).first().click()
  await updateResponse

  expect(savedBody).toContain("https://portal.acme.example/silent")
  expect(savedBody).toContain(projectId)
})
