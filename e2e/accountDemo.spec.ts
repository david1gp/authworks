import { expect, test } from "@playwright/test"
import { productionAccountSessionBootstrap } from "./productionAccountSessionBootstrap.js"

const realmId = "01900000-0000-7000-8000-000000000001"

test("the account directory enumerates self-service destinations", async ({ page }) => {
  await page.goto("/demo/account")

  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Personal information", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Application consents", exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Sessions and devices", exact: true }).click()
  await expect(page.getByText("Stateless fixture preview", { exact: true })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Fixture state" })).toBeVisible()
})

test("organization, invitation, and consent demos are interactive and network-free", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr") requests.push(request.url())
  })

  await page.goto("/demo/account/organizations")
  await expect(page.getByRole("navigation", { name: "Fixture state", exact: true })).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Access", exact: true })).toHaveCount(0)
  const organizationSection = page.getByRole("region", { name: "Organization to view", exact: true })
  const organizationTabs = organizationSection.getByRole("tab")
  await expect(organizationTabs).toHaveCount(2)
  await expect(organizationTabs.nth(0)).toHaveAttribute("aria-selected", "true")
  const organizationPanel = organizationSection.getByRole("tabpanel")
  await expect(organizationPanel).toHaveAttribute("aria-labelledby", /-tab-/)
  await expect(organizationPanel.getByRole("heading", { name: "Northwind Labs", exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("heading", { name: "Customer portal", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toBeVisible()

  await organizationTabs.nth(0).focus()
  await organizationTabs.nth(0).press("ArrowRight")
  await expect(organizationTabs.nth(1)).toHaveAttribute("aria-selected", "true")
  await expect(organizationPanel.getByRole("heading", { name: "Field Notes", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("member", { exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("button", { name: "Make active organization", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toHaveCount(0)
  await expect(
    organizationSection.getByText("Organization context changed to Field Notes.", { exact: true }),
  ).toHaveCount(0)

  await organizationPanel.getByRole("button", { name: "Make active organization", exact: true }).click()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("button", { name: "Make active organization", exact: true })).toHaveCount(0)
  await expect(
    organizationSection.getByText("Organization context changed to Field Notes.", { exact: true }),
  ).toBeVisible()

  await page.goto("/demo/account/consents")
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Revoke" }).first().click()
  await expect(page.getByRole("status")).toContainText("revoked")

  // The overview must lead to the accept destination instead of only describing a missing link.
  await page.goto("/demo/invitations")
  await expect(page.getByText("Open the complete invitation link to continue.")).toHaveCount(0)
  await page.getByRole("link", { name: "Open invitation", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/invitations\/accept$/)
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible()

  await page.goto("/demo/invitations/accept?state=expired")
  await expect(page.getByText("This invitation has expired.")).toBeVisible()
  await page.goto("/demo/invitations/accept?state=success")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Invitation accepted" })).toBeVisible()

  expect(requests).toEqual([])
})

test("account security demos are fixture-backed and interactive", async ({ page }) => {
  const apiRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/realms/")) apiRequests.push(request.url())
  })

  await page.goto("/demo/account/overview")
  const securityOverview = page.locator("[data-account-security-overview]")
  await expect(securityOverview.locator("dl")).toHaveCount(5)
  for (const label of ["Password", "Email", "Phone", "Passkeys", "Backup codes"])
    await expect(securityOverview.getByText(label, { exact: true })).toBeVisible()
  for (const detail of [
    "Password set",
    "avery.stone@example.com verified",
    "+14155552671 verified",
    "2 passkeys configured",
    "7 backup codes remaining",
  ])
    await expect(securityOverview.getByText(detail, { exact: true })).toBeVisible()

  await page.goto("/demo/account/overview?state=empty")
  await expect(page.locator("[data-account-security-overview]")).toContainText("No password set")
  await expect(page.locator("[data-account-security-overview]")).toContainText("No verified email")

  await page.goto("/demo/account/sessions")
  await expect(page.getByRole("heading", { level: 1, name: "Sessions and devices", exact: true })).toBeVisible()
  await expect(page.getByText("Firefox on Linux", { exact: true })).toBeVisible()
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Revoke session" }).click()
  await expect(page.getByText("Safari on iPhone", { exact: true })).toHaveCount(0)

  await page.goto("/demo/account/passkeys?state=empty")
  await expect(page.getByRole("heading", { name: "No passkeys registered", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "loading", exact: true }).click()
  await expect(page.getByRole("status")).toBeVisible()

  await page.goto("/demo/account/factors")
  await expect(page.getByText("7 recovery codes", { exact: true })).toBeVisible()
  await expect(page.getByText("Configured", { exact: true }).first()).toBeVisible()

  await page.goto("/demo/account/recovery-codes?state=one-time")
  await expect(page.locator('[data-one-time-secret="recovery-codes"]')).toBeVisible()
  await page.getByRole("button", { name: "I saved these codes" }).click()
  await expect(page.getByText("AX7K-2QPL", { exact: true })).toHaveCount(0)

  await page.goto("/demo/account/identities")
  await page.getByRole("button", { name: "Unlink" }).first().click()
  await expect(page.getByRole("heading", { name: "GitHub", exact: true })).toHaveCount(0)

  await page.goto("/demo/account/security-history")
  await expect(page.getByRole("heading", { name: "Security history", exact: true })).toBeVisible()
  await expect(page.getByText("A session was created", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Load more security activity", exact: true }).click()
  await expect(page.getByText("An impersonation session started", { exact: true })).toBeVisible()
  expect(apiRequests).toEqual([])
})

test("production security history uses the safe newest-first cursor contract", async ({ page }) => {
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/me/security-history**`, (route) => {
    const hasPageToken = new URL(route.request().url()).searchParams.has("pageToken")
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        hasPageToken
          ? {
              items: [
                {
                  category: "impersonation",
                  displayCode: "impersonation.started",
                  id: "history-2",
                  occurredAt: 1_777_000_000_001,
                },
              ],
            }
          : {
              items: [
                {
                  category: "sessions",
                  displayCode: "session.created",
                  id: "history-1",
                  occurredAt: 1_777_000_000_002,
                },
              ],
              nextPageToken: "history-cursor-1",
            },
      ),
    })
  })

  await page.goto("/account#devices-applications")
  const devicesApplicationsSection = page.locator("#devices-applications")
  await expect(devicesApplicationsSection.getByText("A session was created", { exact: true })).toBeVisible()
  await expect(devicesApplicationsSection.getByText("session.created", { exact: true })).toHaveCount(0)
  await devicesApplicationsSection.getByRole("button", { name: "Load more security activity", exact: true }).click()
  await expect(devicesApplicationsSection.getByText("An impersonation session started", { exact: true })).toBeVisible()
})

test("production session revocation uses the real account contract and CSRF", async ({ page }) => {
  let csrfHeader: string | null = null
  let sessions = [
    {
      assurance: "authenticated",
      authenticationMethod: "password",
      createdAt: 1_777_000_000_000,
      current: true,
      device: { description: "Current browser", ipAddress: "192.0.2.1" },
      expiresAt: 1_778_000_000_000,
      id: "current",
      lastUsedAt: 1_777_000_100_000,
      revokedAt: null,
    },
    {
      assurance: "authenticated",
      authenticationMethod: "passkey",
      createdAt: 1_776_000_000_000,
      current: false,
      device: { description: "Fixture phone", ipAddress: "198.51.100.2" },
      expiresAt: 1_778_000_000_000,
      id: "phone",
      lastUsedAt: 1_777_000_000_000,
      revokedAt: null,
    },
  ]
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/sessions/csrf`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "deterministic-csrf-token-12345678901234567890" }),
    }),
  )
  await page.route(`**/realms/${realmId}/me/sessions`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: sessions }) })
      return
    }
    await route.fallback()
  })
  await page.route(`**/realms/${realmId}/me/sessions/phone`, async (route) => {
    csrfHeader = await route.request().headerValue("x-csrf-token")
    sessions = sessions.filter((session) => session.id !== "phone")
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ revoked: true }) })
  })

  await page.goto("/account#devices-applications")
  const devicesApplicationsSection = page.locator("#devices-applications")
  await expect(devicesApplicationsSection.getByText("Fixture phone", { exact: true })).toBeVisible()
  page.once("dialog", (dialog) => void dialog.accept())
  await devicesApplicationsSection.getByRole("button", { name: "Revoke session" }).click()
  await expect(devicesApplicationsSection.getByText("Fixture phone", { exact: true })).toHaveCount(0)
  expect(csrfHeader).toBe("deterministic-csrf-token-12345678901234567890")
})

test("production recovery codes are fetched with CSRF and displayed once", async ({ page }) => {
  let csrfHeader: string | null = null
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/me/authentication-methods`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        emailOtp: { available: true },
        password: { available: true },
        passkeys: { credentials: [] },
        recoveryCodes: { available: true, generatedAt: 1_777_000_000_000, remaining: 6 },
        totp: { enrolled: true, enrollments: [] },
      }),
    }),
  )
  await page.route(`**/realms/${realmId}/sessions/csrf`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ csrfToken: "recovery-csrf" }) }),
  )
  await page.route(`**/realms/${realmId}/mfa/recovery-codes`, async (route) => {
    csrfHeader = await route.request().headerValue("x-csrf-token")
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ codes: ["REAL-API1", "REAL-API2"], generatedAt: 1_777_100_000_000 }),
    })
  })

  await page.goto("/account#security")
  const securitySection = page.locator("#security")
  await securitySection.getByRole("button", { name: "Generate new codes" }).click()
  await expect(securitySection.getByText("REAL-API1", { exact: true })).toBeVisible()
  expect(csrfHeader).toBe("recovery-csrf")
  await securitySection.getByRole("button", { name: "I saved these codes" }).click()
  await expect(securitySection.getByText("REAL-API1", { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.locator("#security").getByText("REAL-API1", { exact: true })).toHaveCount(0)
})
