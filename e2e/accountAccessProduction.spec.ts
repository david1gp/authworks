import { expect, test } from "@playwright/test"
import { productionAccountSessionBootstrap } from "./productionAccountSessionBootstrap.js"

const realmId = "01900000-0000-7000-8000-000000000001"
const northwindId = "01900000-0000-7000-8000-000000000002"
const fieldNotesId = "01900000-0000-7000-8000-000000000004"
const userId = "01900000-0000-7000-8000-0000000000b1"

const organizationItems = [
  {
    membership: {
      createdAt: 1,
      id: "01900000-0000-7000-8000-000000000005",
      organizationId: northwindId,
      realmId,
      roles: ["owner"],
      updatedAt: 1,
      userId,
    },
    organization: {
      createdAt: 1,
      id: northwindId,
      name: "Northwind Labs",
      realmId,
      status: "active",
      updatedAt: 1,
    },
  },
  {
    membership: {
      createdAt: 1,
      id: "01900000-0000-7000-8000-000000000006",
      organizationId: fieldNotesId,
      realmId,
      roles: ["member"],
      updatedAt: 1,
      userId,
    },
    organization: {
      createdAt: 1,
      id: fieldNotesId,
      name: "Field Notes",
      realmId,
      status: "active",
      updatedAt: 1,
    },
  },
]

test("production organization switching calls the self-service API with CSRF", async ({ page }) => {
  let switchRequestHadCsrf = false
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === `/realms/${realmId}` || pathname.endsWith("/sessions/current") || pathname.endsWith("/me"))
      return route.fallback()
    if (pathname.endsWith("/sessions/csrf")) {
      return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    }
    if (pathname.endsWith("/me/organizations/switch")) {
      switchRequestHadCsrf = request.headers()["x-csrf-token"] === "csrf-e2e"
      return route.fulfill({
        json: {
          activeOrganizationId: fieldNotesId,
          context: {
            actor: {
              actorId: userId,
              assurance: "authenticated",
              authenticationMethod: "trusted",
              kind: "user",
              organizationId: fieldNotesId,
              realmId,
            },
            actorId: userId,
            kind: "organization",
            organizationId: fieldNotesId,
            realmId,
          },
          organization: organizationItems[1]?.organization,
        },
      })
    }
    return route.fulfill({ json: { items: organizationItems } })
  })

  await page.goto("/account#access")
  const accessSection = page.locator("#access")
  const organizationsSection = accessSection.getByRole("region", { name: "Switch organization", exact: true })
  await expect(organizationsSection.getByRole("heading", { name: "Field Notes", exact: true })).toBeVisible()
  const fieldNotesOrganization = organizationsSection.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Field Notes", exact: true }),
  })
  await fieldNotesOrganization.getByRole("button", { name: "Switch organization", exact: true }).click()
  // Organization selection reloads the authenticated context so the shell and all workspace sections
  // use the new organization. The transient switch notice does not survive that navigation.
  await expect(page).toHaveURL(new RegExp(`/account\\?organization=${fieldNotesId}#access$`))
  await expect(fieldNotesOrganization.getByText("Active organization", { exact: true })).toBeVisible()
  expect(switchRequestHadCsrf).toBe(true)
})

test("production consent and invitation adapters expose permission and expiry failures", async ({ page }) => {
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === `/realms/${realmId}` || pathname.endsWith("/sessions/current") || pathname.endsWith("/me"))
      return route.fallback()
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/me/emails")) return route.fulfill({ json: { items: [] } })
    if (pathname.endsWith("/passkeys")) return route.fulfill({ json: { items: [] } })
    if (pathname.endsWith("/me/authentication-methods")) {
      return route.fulfill({
        json: {
          emailOtp: { available: true },
          passkeys: { credentials: [] },
          recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
          totp: { enrolled: false, enrollments: [] },
        },
      })
    }
    if (pathname.endsWith("/me/external-identities") || pathname.endsWith("/me/external-identity-providers"))
      return route.fulfill({ json: { items: [] } })
    if (
      pathname.endsWith("/me/refresh-tokens") ||
      pathname.endsWith("/me/security-history") ||
      pathname.endsWith("/me/effective-access")
    )
      return route.fulfill({ json: { items: [] } })
    if (pathname.endsWith("/me/consents") && request.method() === "GET") {
      return route.fulfill({
        json: {
          items: [
            {
              clientId: "018f0000-0000-7000-8000-000000000006",
              createdAt: 1,
              realmId,
              scope: ["openid", "profile"],
              updatedAt: 1,
              userId,
            },
          ],
        },
      })
    }
    if (pathname.includes("/me/consents/") && pathname.endsWith("/revoke")) {
      return route.fulfill({
        json: {
          error: {
            code: "oidc.forbidden",
            message: "Consent cannot be revoked.",
            op: "oidcConsentMeRevoke",
            status: 403,
          },
        },
        status: 403,
      })
    }
    if (pathname.endsWith("/me/invitations/inspect")) {
      return route.fulfill({
        json: {
          error: {
            code: "organizations.expired",
            message: "The invitation expired.",
            op: "organizationInvitationMeInspect",
            status: 409,
          },
        },
        status: 409,
      })
    }
    return route.abort()
  })

  await page.goto("/account#devices-applications")
  const devicesApplicationsSection = page.locator("#devices-applications")
  page.once("dialog", (dialog) => dialog.accept())
  await devicesApplicationsSection.getByRole("button", { name: "Revoke" }).click()
  await expect(devicesApplicationsSection.getByText("You do not have permission to perform this action.")).toBeVisible()

  await page.goto("/invitations/accept?token=expired-fixture")
  await expect(page.getByText("This invitation has expired.")).toBeVisible()
})
