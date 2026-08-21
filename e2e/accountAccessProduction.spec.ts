import { expect, test } from "@playwright/test"

const realmId = "018f0000-0000-7000-8000-000000000001"
const northwindId = "018f0000-0000-7000-8000-000000000002"
const fieldNotesId = "018f0000-0000-7000-8000-000000000003"
const userId = "018f0000-0000-7000-8000-000000000007"

const organizationItems = [
  {
    membership: {
      createdAt: 1,
      id: "018f0000-0000-7000-8000-000000000004",
      organizationId: northwindId,
      realmId,
      roles: ["owner"],
      updatedAt: 1,
      userId: "shell-user",
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
      id: "018f0000-0000-7000-8000-000000000005",
      organizationId: fieldNotesId,
      realmId,
      roles: ["member"],
      updatedAt: 1,
      userId: "shell-user",
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
  await page.route("**/realms/customer-identity/**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
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
              actorId: "shell-user",
              assurance: "authenticated",
              authenticationMethod: "trusted",
              kind: "user",
              organizationId: "field-notes",
              realmId: "customer-identity",
            },
            actorId: "shell-user",
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

  await page.goto("/account/organizations")
  await expect(page.getByRole("heading", { name: "Field Notes" })).toBeVisible()
  await page.getByRole("button", { name: "Switch organization" }).last().click()
  await expect(page.getByRole("status")).toContainText("Field Notes")
  expect(switchRequestHadCsrf).toBe(true)
})

test("production consent and invitation adapters expose permission and expiry failures", async ({ page }) => {
  await page.route("**/realms/customer-identity/**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
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

  await page.goto("/account/consents")
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Revoke" }).click()
  await expect(page.getByText("You do not have permission to perform this action.")).toBeVisible()

  await page.goto("/invitations/accept?token=expired-fixture")
  await expect(page.getByText("This invitation has expired.")).toBeVisible()
})
