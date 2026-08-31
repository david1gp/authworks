import { expect, type Page, test } from "@playwright/test"
import type { AccountEffectiveAccessEntry } from "../src/features/account/public/accountEffectiveAccessEntrySchema.js"
import type { OrganizationMe } from "../src/features/organizations/public/organizationMeSchema.js"
import type { OrganizationRoles } from "../src/features/organizations/public/organizationRolesSchema.js"
import { productionAccountSessionBootstrap } from "./productionAccountSessionBootstrap.js"

const realmId = "01900000-0000-7000-8000-000000000001"
const northwindId = "01900000-0000-7000-8000-000000000002"
const fieldNotesId = "01900000-0000-7000-8000-000000000004"
const userId = "01900000-0000-7000-8000-0000000000b1"

const organizationItems = [
  organizationItemCreate(northwindId, "Northwind Labs", ["owner"], 1),
  organizationItemCreate(fieldNotesId, "Field Notes", ["member"], 2),
]
const effectiveAccessItems = effectiveAccessItemsCreate(organizationItems)
const largeOrganizationItems = [
  ...organizationItems,
  ...Array.from({ length: 7 }, (_, index) =>
    organizationItemCreate(
      `01900000-0000-7000-8000-${String(10 + index).padStart(12, "0")}`,
      `Organization ${index + 3}`,
      ["member"],
      index + 3,
    ),
  ),
]

test("production organization tabs keep viewing separate from explicit activation", async ({ page }) => {
  const switchRequests: { readonly csrf: string | undefined; readonly organizationId: string }[] = []
  const profileRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/realms/${realmId}/me`) profileRequests.push(request.url())
  })
  await productionAccountSessionBootstrap(page)
  await accountOrganizationRoutesInstall(page, organizationItems, effectiveAccessItems)
  await page.route(`**/realms/${realmId}/sessions/csrf`, (route) => route.fulfill({ json: { csrfToken: "csrf-e2e" } }))
  await page.route(`**/realms/${realmId}/me/organizations/switch`, async (route) => {
    const request = route.request()
    const organizationId = (request.postDataJSON() as { readonly organizationId: string }).organizationId
    switchRequests.push({ csrf: request.headers()["x-csrf-token"], organizationId })
    await route.fulfill({ json: organizationSwitchResponseCreate(organizationItems[1]!) })
  })

  await page.goto("/account#access")
  const accessSection = page.locator("#access")
  const accountNavigation = page.getByRole("navigation", { name: "Account navigation", exact: true })
  await expect(accountNavigation).toHaveCount(1)
  await expect(accessSection.getByRole("navigation")).toHaveCount(0)

  const organizationsSection = accessSection.getByRole("region", { name: "Organization to view", exact: true })
  const organizationTabs = organizationsSection.getByRole("tab")
  await expect(organizationTabs).toHaveCount(2)
  await expect(organizationTabs.nth(0)).toHaveAttribute("aria-selected", "true")
  const organizationPanel = organizationsSection.getByRole("tabpanel")
  await expect(organizationPanel.getByRole("heading", { name: "Northwind Labs", exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("heading", { name: "Customer portal", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Personal information", exact: true })).toBeVisible()

  await organizationTabs.nth(0).focus()
  await organizationTabs.nth(0).press("ArrowRight")
  await expect(organizationTabs.nth(1)).toHaveAttribute("aria-selected", "true")
  await expect(organizationPanel.getByRole("heading", { name: "Field Notes", exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("heading", { name: "Field Notes board", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("member", { exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("organization.read", { exact: false })).toBeVisible()
  await expect(organizationPanel.getByRole("button", { name: "Make active organization", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "Organization", exact: true })).toHaveValue(northwindId)
  expect(switchRequests).toEqual([])
  const profileRequestCountBeforeActivation = profileRequests.length

  await organizationPanel.getByRole("button", { name: "Make active organization", exact: true }).click()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("button", { name: "Make active organization", exact: true })).toHaveCount(0)
  await expect(organizationTabs.nth(1)).toContainText("Active organization")
  await expect(page.getByRole("combobox", { name: "Organization", exact: true })).toHaveValue(fieldNotesId)
  await expect(page).toHaveURL(new RegExp(`/account\\?organization=${fieldNotesId}#access$`))
  expect(switchRequests).toEqual([{ csrf: "csrf-e2e", organizationId: fieldNotesId }])
  // Viewing a tab is local-only; explicit activation refreshes the organization-scoped account data once.
  await expect.poll(() => profileRequests.length).toBe(profileRequestCountBeforeActivation + 1)
})

test("production organization access uses a native select above eight memberships", async ({ page }) => {
  const switchRequests: string[] = []
  await productionAccountSessionBootstrap(page)
  await accountOrganizationRoutesInstall(
    page,
    largeOrganizationItems,
    effectiveAccessItemsCreate(largeOrganizationItems),
    organizationItems,
  )
  await page.route(`**/realms/${realmId}/me/organizations/switch`, async (route) => {
    switchRequests.push(route.request().url())
    await route.fallback()
  })

  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto("/account#access")
  const accessSection = page.locator("#access")
  const organizationsSection = accessSection.getByRole("region", { name: "Organization to view", exact: true })
  const organizationSelect = organizationsSection.locator("select")
  await expect(organizationSelect).toHaveCount(1)
  await expect(organizationSelect).toHaveAttribute("id", "account-access-organization-panel-select")
  await expect(organizationsSection.locator('label[for="account-access-organization-panel-select"]')).toHaveCount(1)
  await expect(organizationSelect.locator("option")).toHaveCount(9)
  await expect(organizationSelect).toHaveValue(northwindId)
  await expect(organizationsSection.getByRole("tablist")).toHaveCount(0)
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true)

  await organizationSelect.selectOption(fieldNotesId)
  await expect(organizationSelect).toHaveValue(fieldNotesId)
  await expect(
    organizationsSection.getByRole("tabpanel").getByRole("heading", { name: "Field Notes", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Organization", exact: true })).toHaveValue(northwindId)
  expect(switchRequests).toEqual([])

  await page.setViewportSize({ height: 844, width: 390 })
  await page.reload()
  const mobileOrganizationsSection = page.locator("#access").getByRole("region", {
    name: "Organization to view",
    exact: true,
  })
  await expect(mobileOrganizationsSection.locator("select")).toHaveCount(1)
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true)
})

test("production organization tabs preserve a usable mobile layout", async ({ page }) => {
  await productionAccountSessionBootstrap(page)
  await accountOrganizationRoutesInstall(page, organizationItems, effectiveAccessItems)
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/account#access")

  const organizationsSection = page
    .locator("#access")
    .getByRole("region", { name: "Organization to view", exact: true })
  const organizationTabs = organizationsSection.getByRole("tab")
  const tabList = organizationsSection.getByRole("tablist")
  await expect(organizationTabs).toHaveCount(2)
  await expect(tabList).toHaveCSS("overflow-x", "auto")
  await expect(tabList).toHaveCSS("flex-wrap", "nowrap")
  await expect(organizationsSection.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", /-tab-/)
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true)
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
          password: { available: true },
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

function organizationItemCreate(
  id: string,
  name: string,
  roles: OrganizationRoles,
  membershipNumber: number,
): OrganizationMe {
  return {
    membership: {
      createdAt: 1_700_000_000_000,
      id: `membership-${membershipNumber}`,
      organizationId: id,
      realmId,
      roles: [...roles],
      updatedAt: 1_700_000_000_000,
      userId,
    },
    organization: {
      createdAt: 1_700_000_000_000,
      id,
      name,
      realmId,
      status: "active",
      updatedAt: 1_700_000_000_000,
    },
  }
}

function effectiveAccessItemsCreate(items: readonly OrganizationMe[]): AccountEffectiveAccessEntry[] {
  return items.flatMap((item, index) => {
    const organization = { membership: item.membership, organization: item.organization }
    const projectId = String(101 + index)
    const fieldNotes = item.organization.id === fieldNotesId
    return [
      {
        id: `organization:${item.organization.id}`,
        organization,
        permissions: fieldNotes ? ["organization.read"] : ["organization.read", "organization.switch"],
        roleKeys: [...item.membership.roles],
        source: "membership" as const,
      },
      {
        grant: fieldNotes
          ? {
              createdAt: 1_700_000_000_000,
              grantedOrganizationId: northwindId,
              id: String(301 + index),
              organizationId: item.organization.id,
              projectId,
              realmId,
              roleKeys: ["viewer"],
              status: "active" as const,
              updatedAt: 1_700_000_000_000,
            }
          : undefined,
        id: `project:${item.organization.id}`,
        organization,
        permissions: fieldNotes ? ["project.read"] : ["project.read", "project.write"],
        project: {
          authorizationRequired: true,
          createdAt: 1_700_000_000_000,
          id: projectId,
          name: fieldNotes
            ? "Field Notes board"
            : index === 0
              ? "Customer portal"
              : `${item.organization.name} project`,
          organizationId: item.organization.id,
          projectAccessRequired: true,
          realmId,
          status: "active" as const,
          updatedAt: 1_700_000_000_000,
        },
        roleKeys: fieldNotes ? ["viewer"] : [...item.membership.roles],
        source: fieldNotes ? ("project-grant" as const) : ("project-owner" as const),
      },
    ]
  })
}

async function accountOrganizationRoutesInstall(
  page: Page,
  organizations: readonly OrganizationMe[],
  effectiveAccess: readonly AccountEffectiveAccessEntry[],
  initialOrganizations: readonly OrganizationMe[] = organizations,
): Promise<void> {
  let organizationRequestCount = 0
  await page.route(`**/realms/${realmId}/me/organizations`, (route) => {
    const items = organizationRequestCount++ === 0 ? initialOrganizations : organizations
    return route.fulfill({ json: { items } })
  })
  await page.route(`**/realms/${realmId}/me/effective-access**`, (route) =>
    route.fulfill({ json: { items: effectiveAccess } }),
  )
}

function organizationSwitchResponseCreate(organization: OrganizationMe) {
  return {
    activeOrganizationId: organization.organization.id,
    context: {
      actor: {
        actorId: userId,
        assurance: "authenticated" as const,
        authenticationMethod: "trusted" as const,
        kind: "user" as const,
        organizationId: organization.organization.id,
        realmId,
      },
      actorId: userId,
      kind: "organization" as const,
      organizationId: organization.organization.id,
      realmId,
    },
    organization: organization.organization,
  }
}
