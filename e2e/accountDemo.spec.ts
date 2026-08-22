import { expect, test } from "@playwright/test"

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
  await expect(page.getByRole("heading", { name: "Northwind Labs" })).toBeVisible()
  await page.getByRole("button", { name: "Switch organization" }).last().click()
  await expect(page.getByRole("status")).toContainText("Field Notes")

  await page.goto("/demo/account/consents")
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Revoke" }).first().click()
  await expect(page.getByRole("status")).toContainText("revoked")

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

  await page.goto("/demo/account/sessions")
  await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible()
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
  await expect(page.getByText("Configured", { exact: true })).toBeVisible()

  await page.goto("/demo/account/recovery-codes?state=one-time")
  await expect(page.locator('[data-one-time-secret="recovery-codes"]')).toBeVisible()
  await page.getByRole("button", { name: "I saved these codes" }).click()
  await expect(page.getByText("AX7K-2QPL", { exact: true })).toHaveCount(0)

  await page.goto("/demo/account/identities")
  await page.getByRole("button", { name: "Unlink" }).first().click()
  await expect(page.getByRole("heading", { name: "GitHub", exact: true })).toHaveCount(0)
  expect(apiRequests).toEqual([])
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
  await page.route("**/realms/customer-identity/sessions/csrf", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "deterministic-csrf-token-12345678901234567890" }),
    }),
  )
  await page.route("**/realms/customer-identity/me/sessions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: sessions }) })
      return
    }
    await route.fallback()
  })
  await page.route("**/realms/customer-identity/me/sessions/phone", async (route) => {
    csrfHeader = await route.request().headerValue("x-csrf-token")
    sessions = sessions.filter((session) => session.id !== "phone")
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ revoked: true }) })
  })

  await page.goto("/account/sessions")
  await expect(page.getByText("Fixture phone", { exact: true })).toBeVisible()
  page.once("dialog", (dialog) => void dialog.accept())
  await page.getByRole("button", { name: "Revoke session" }).click()
  await expect(page.getByText("Fixture phone", { exact: true })).toHaveCount(0)
  expect(csrfHeader).toBe("deterministic-csrf-token-12345678901234567890")
})

test("production recovery codes are fetched with CSRF and displayed once", async ({ page }) => {
  let csrfHeader: string | null = null
  await page.route("**/realms/customer-identity/me/authentication-methods", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        emailOtp: { available: true },
        passkeys: { credentials: [] },
        recoveryCodes: { available: true, generatedAt: 1_777_000_000_000, remaining: 6 },
        totp: { enrolled: true, enrollments: [] },
      }),
    }),
  )
  await page.route("**/realms/customer-identity/sessions/csrf", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ csrfToken: "recovery-csrf" }) }),
  )
  await page.route("**/realms/customer-identity/mfa/recovery-codes", async (route) => {
    csrfHeader = await route.request().headerValue("x-csrf-token")
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ codes: ["REAL-API1", "REAL-API2"], generatedAt: 1_777_100_000_000 }),
    })
  })

  await page.goto("/account/recovery-codes")
  await page.getByRole("button", { name: "Generate new codes" }).click()
  await expect(page.getByText("REAL-API1", { exact: true })).toBeVisible()
  expect(csrfHeader).toBe("recovery-csrf")
  await page.getByRole("button", { name: "I saved these codes" }).click()
  await expect(page.getByText("REAL-API1", { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText("REAL-API1", { exact: true })).toHaveCount(0)
})
