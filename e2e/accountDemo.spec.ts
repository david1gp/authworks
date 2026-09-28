import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { productionAccountSessionBootstrap } from "./productionAccountSessionBootstrap.js"

const realmId = "01900000-0000-7000-8000-000000000001"

test("the account demo landing page composes the full example account workspace", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr") requests.push(request.url())
  })
  await page.goto("/demo/account")

  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible()
  const devices = page.getByRole("region", { name: "Devices and applications" })
  for (const summary of ["Recent security activity", "Sessions and devices", "Applications"])
    await expect(devices.locator("summary").filter({ hasText: summary })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Access", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Danger zone", exact: true })).toBeVisible()
  await expect(page.getByText("Avery Stone", { exact: true }).first()).toBeVisible()
  await page.locator("#profile summary").filter({ hasText: "Email addresses" }).click()
  await expect(page.getByText("avery.secondary@example.com", { exact: true })).toBeVisible()
  await devices.locator("summary").filter({ hasText: "Sessions and devices" }).click()
  await expect(page.getByText("Firefox on Linux", { exact: true })).toBeVisible()
  await page.locator("#access summary").filter({ hasText: "Organizations" }).click()
  await expect(page.getByRole("heading", { name: "Northwind Labs", exact: true })).toBeVisible()
  await expect(page.getByText("Stateless fixture preview", { exact: true })).toHaveCount(0)
  expect(requests).toEqual([])
})

test("organization, invitation, and consent demos are interactive and network-free", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr") requests.push(request.url())
  })

  await page.goto("/demo/account/organizations")
  await expect(page.getByRole("navigation", { name: "Fixture state", exact: true })).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Access", exact: true })).toHaveCount(0)
  await page.locator("summary").filter({ hasText: "Organizations" }).click()
  const organizationSection = page.getByRole("tablist", { name: "Organization to view", exact: true })
  const organizationTabs = organizationSection.getByRole("tab")
  await expect(organizationTabs).toHaveCount(2)
  await expect(organizationTabs.nth(0)).toHaveAttribute("aria-selected", "true")
  const organizationPanel = page.getByRole("tabpanel")
  await expect(organizationPanel).toHaveAttribute("aria-labelledby", /-tab-/)
  await expect(organizationPanel.getByRole("heading", { name: "Northwind Labs", exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("heading", { name: "Customer portal", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toBeVisible()

  await organizationTabs.nth(0).focus()
  await organizationTabs.nth(0).press("ArrowRight")
  await expect(organizationTabs.nth(1)).toHaveAttribute("aria-selected", "true")
  await expect(organizationPanel.getByRole("heading", { name: "Field Notes", exact: true })).toBeVisible()
  await expect(organizationPanel.getByText("member", { exact: true })).toBeVisible()
  await expect(organizationPanel.getByRole("button", { name: "Make active organization", exact: true })).toHaveCount(0)
  await expect(organizationPanel.getByText("Active organization", { exact: true })).toHaveCount(0)
  await expect(
    organizationSection.getByText("Organization context changed to Field Notes.", { exact: true }),
  ).toHaveCount(0)

  await page.goto("/demo/account/consents")
  await page.locator("summary").filter({ hasText: "Application consents" }).click()
  await page.getByRole("list", { name: "Application consents" }).getByRole("button").first().click()
  await page.getByRole("dialog").getByRole("button", { name: "Revoke" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
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
  await expect(page.getByRole("heading", { level: 1, name: "Security setup", exact: true })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Fixture state", exact: true })).toHaveCount(1)
  const securityGrid = page.locator("[data-account-security-grid]")
  await expect(securityGrid.locator(":scope > details")).toHaveCount(5)
  for (const detail of ["Password set", "2 passkeys configured", "7 backup codes remaining"])
    await expect(securityGrid.locator("summary").getByText(detail, { exact: true })).toBeVisible()
  await expect(securityGrid.locator("summary").filter({ hasText: /[Cc]onfigured/ })).toHaveCount(5)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.goto("/demo/account/overview?state=empty")
  await expect(page.locator("[data-account-security-grid]")).toContainText("No password set")
  await expect(page.locator("[data-account-security-grid]")).toContainText("No verified email")
  await expect(page.locator("[data-account-security-grid] summary").filter({ hasText: "Not configured" })).toHaveCount(
    4,
  )
  await expect(
    page.locator("[data-account-security-grid] summary").filter({ hasText: "Authenticator missing" }),
  ).toHaveCount(1)

  await page.goto("/demo/account/sessions")
  await expect(page.getByRole("heading", { level: 1, name: "Sessions and devices", exact: true })).toBeVisible()
  await page.locator("summary").filter({ hasText: "Sessions and devices" }).click()
  await expect(page.getByText("Firefox on Linux", { exact: true })).toBeVisible()
  await page
    .getByRole("list", { name: "Sessions and devices" })
    .getByRole("button", { name: /Safari on iPhone/ })
    .click()
  await page.getByRole("dialog").getByRole("button", { name: "Revoke session" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByText("Safari on iPhone", { exact: true })).toHaveCount(0)

  await page.goto("/demo/account/passkeys?state=empty")
  await page.locator("summary").filter({ hasText: "Passkeys" }).click()
  await expect(page.getByText("No passkeys registered", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "loading", exact: true }).click()
  await expect(page.getByRole("status")).toBeVisible()

  await page.goto("/demo/account/factors")
  await expect(page.getByText("1 authenticators", { exact: true })).toBeVisible()
  await expect(page.locator("summary").filter({ hasText: "Authenticator configured" })).toBeVisible()

  await page.goto("/demo/account/recovery-codes?state=one-time")
  await expect(page.locator('[data-one-time-secret="recovery-codes"]')).toBeVisible()
  await page.getByRole("button", { name: "I saved these codes" }).click()
  await expect(page.getByText("AX7K-2QPL", { exact: true })).toHaveCount(0)

  await page.goto("/demo/account/identities")
  await page.locator("summary").filter({ hasText: "Linked identities" }).click()
  await page
    .getByRole("list", { name: "Linked identities" })
    .getByRole("button", { name: /GitHub/ })
    .click()
  await page.getByRole("dialog").getByRole("button", { name: "Unlink" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
  await expect(
    page.getByRole("list", { name: "Linked identities" }).getByRole("button", { name: /GitHub/ }),
  ).toHaveCount(0)

  await page.goto("/demo/account/security-history")
  await page.locator("summary").filter({ hasText: "Recent security activity" }).click()
  await expect(page.getByText("A session was created", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Load more security activity", exact: true }).click()
  await expect(page.getByText("An impersonation session started", { exact: true })).toBeVisible()
  expect(apiRequests).toEqual([])
})

test("the full production security composition remains responsive, accessible, and actionable", async ({ page }) => {
  const fixture = await productionSecurityCompositionBootstrap(page)

  for (const viewport of [
    { columns: 3, height: 900, name: "desktop", width: 1600 },
    { columns: 1, height: 844, name: "mobile", width: 390 },
  ] as const) {
    fixture.reset()
    await page.setViewportSize(viewport)
    await page.goto("/account#security")
    await page.reload()

    const securitySection = page.locator("#security")
    const securityGrid = securitySection.locator("[data-account-security-grid]")
    await expect(securityGrid.locator(":scope > details"), viewport.name).toHaveCount(5)
    for (const title of ["Passkeys", "Authenticator", "Linked identities", "Password", "Recovery codes"])
      await expect(
        securityGrid.locator("summary").filter({ hasText: title }),
        `${viewport.name}/${title}`,
      ).toBeVisible()
    await expect(page.locator("#profile summary").filter({ hasText: "Phone numbers" })).toBeVisible()

    const profileSection = page.locator("#profile")
    await expect
      .poll(() => securityGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length))
      .toBe(viewport.columns)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    expect((await new AxeBuilder({ page }).include("#security").analyze()).violations).toEqual([])

    const passkeys = securityGrid.locator(":scope > details").nth(0)
    await passkeys.locator("summary").click()
    await passkeys.getByRole("list", { name: "Passkeys" }).getByRole("button").first().click()
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
    await expect(passkeys.getByText("0 passkeys configured", { exact: true })).toBeVisible()
    await passkeys.locator("summary").click()
    await passkeys.getByRole("button", { name: "Add passkey", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Add passkey", exact: true }).click()
    await expect(passkeys.getByText("1 passkeys configured", { exact: true })).toBeVisible()

    const identities = securityGrid.locator(":scope > details").nth(2)
    await identities.locator("summary").click()
    await identities.getByRole("list", { name: "Linked identities" }).getByRole("button").first().click()
    await page.getByRole("dialog").getByRole("button", { name: "Unlink", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
    await expect(identities.getByText("0 linked identities", { exact: true })).toBeVisible()
    await identities.locator("summary").click()
    await identities.getByRole("button", { name: "Link an external account", exact: true }).click()
    await expect(page.getByRole("dialog").getByRole("button", { name: "Google", exact: true })).toBeEnabled()
    await page.keyboard.press("Escape")

    const recovery = securityGrid.locator(":scope > details").nth(4)
    await recovery.locator("summary").click()
    await recovery.getByRole("button", { name: "Generate new codes", exact: true }).click()
    const recoveryDialog = page.getByRole("dialog", { name: "Recovery codes", exact: true })
    await recoveryDialog.getByRole("button", { name: "Generate new codes", exact: true }).click()
    await expect(recoveryDialog.getByText("COMPOSE-API1", { exact: true })).toBeVisible()
    await recoveryDialog.getByRole("button", { name: "I saved these codes", exact: true }).click()
    await expect(recovery.getByText("COMPOSE-API1", { exact: true })).toHaveCount(0)

    const authenticators = securityGrid.locator(":scope > details").nth(1)
    await authenticators.locator("summary").click()
    await authenticators.getByRole("button", { name: /Authenticator app Configured/ }).click()
    const authenticatorDialog = page.getByRole("dialog", { name: "Authenticator app", exact: true })
    await authenticatorDialog.getByRole("button", { name: "Remove authenticator", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
    await expect(authenticators.locator("summary").getByText("0 authenticators", { exact: true })).toBeVisible()
    await authenticators.locator("summary").click()
    const trigger = authenticators.getByRole("button", { name: "Add authenticator", exact: true })
    await trigger.click()
    const dialog = page.getByRole("dialog", { name: "Finish authenticator setup", exact: true })
    const code = dialog.getByLabel("Verification code", { exact: true })
    await expect(dialog.getByText("JBSWY3DPEHPK3PXP", { exact: true })).toBeVisible()
    await code.fill("654321")
    expect(
      (await new AxeBuilder({ page }).include("#security").include('[role="dialog"][aria-modal="true"]').analyze())
        .violations,
    ).toEqual([])
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(code).toHaveValue("")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(trigger).toBeFocused()
  }
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
  await devicesApplicationsSection.locator("summary").filter({ hasText: "Recent security activity" }).click()
  await expect(devicesApplicationsSection.getByText("A session was created", { exact: true })).toBeVisible()
  await expect(devicesApplicationsSection.getByText("session.created", { exact: true })).toHaveCount(0)
  await devicesApplicationsSection.getByRole("button", { name: "Load more security activity", exact: true }).click()
  await expect(devicesApplicationsSection.getByText("An impersonation session started", { exact: true })).toBeVisible()
})

test("production authenticator enrollment stays in a resettable accessible dialog", async ({ page }) => {
  let releaseFirstStart: (() => void) | undefined
  const firstStartReleased = new Promise<void>((resolve) => {
    releaseFirstStart = resolve
  })
  let startAttempts = 0
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/sessions/csrf`, (route) =>
    route.fulfill({ json: { csrfToken: "authenticator-dialog-csrf" } }),
  )
  await page.route(`**/realms/${realmId}/mfa/totp/enroll`, async (route) => {
    startAttempts += 1
    if (startAttempts === 1) {
      await firstStartReleased
      await route.fulfill({
        json: { error: { code: "mfa.enrollment-failed", message: "Enrollment could not start.", status: 500 } },
        status: 500,
      })
      return
    }
    await route.fulfill({
      json: {
        enrollment: {
          confirmedAt: null,
          id: `totp-enrollment-${startAttempts}`,
          label: "Authenticator app",
          status: "pending",
          userId: "01900000-0000-7000-8000-0000000000b1",
        },
        otpauthUri: "otpauth://totp/Authworks:user?secret=JBSWY3DPEHPK3PXP&issuer=Authworks",
        secret: "JBSWY3DPEHPK3PXP",
      },
    })
  })
  await page.route(`**/realms/${realmId}/mfa/totp/confirm`, (route) =>
    route.fulfill({
      json: {
        enrollment: {
          confirmedAt: 1_777_000_000_000,
          id: "totp-enrollment-3",
          label: "Authenticator app",
          status: "active",
          userId: "01900000-0000-7000-8000-0000000000b1",
        },
      },
    }),
  )

  await page.goto("/account#security")
  const securitySection = page.locator("#security")
  await securitySection.locator("[data-account-security-grid] > details").nth(1).locator("summary").click()
  const trigger = securitySection.getByRole("button", { name: "Add authenticator", exact: true })
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Finish authenticator setup", exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("status")).toContainText("Loading")
  releaseFirstStart?.()
  await expect(dialog.getByRole("alert")).toContainText("Enrollment could not start.")

  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(dialog.getByText("JBSWY3DPEHPK3PXP", { exact: true })).toBeVisible()
  const code = dialog.getByLabel("Verification code", { exact: true })
  await expect(code).toHaveValue("")
  await code.fill("654321")
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(code).toHaveValue("")
  await code.fill("123456")
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    securitySection.locator("[data-account-security-grid] > details").nth(1).locator("summary"),
  ).toBeVisible()
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
  await devicesApplicationsSection.locator("summary").filter({ hasText: "Sessions and devices" }).click()
  await expect(devicesApplicationsSection.getByText("Fixture phone", { exact: true })).toBeVisible()
  await devicesApplicationsSection
    .getByRole("list", { name: "Sessions and devices" })
    .getByRole("button", { name: /Fixture phone/ })
    .click()
  await page.getByRole("dialog").getByRole("button", { name: "Revoke session" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
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
  await securitySection.locator("[data-account-security-grid] > details").nth(4).locator("summary").click()
  await securitySection.getByRole("button", { name: "Generate new codes" }).click()
  const recoveryDialog = page.getByRole("dialog", { name: "Recovery codes", exact: true })
  await recoveryDialog.getByRole("button", { name: "Generate new codes" }).click()
  await expect(recoveryDialog.getByText("REAL-API1", { exact: true })).toBeVisible()
  expect(csrfHeader).toBe("recovery-csrf")
  await recoveryDialog.getByRole("button", { name: "I saved these codes" }).click()
  await expect(recoveryDialog.getByText("REAL-API1", { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.locator("#security").getByText("REAL-API1", { exact: true })).toHaveCount(0)
})

async function productionSecurityCompositionBootstrap(page: import("@playwright/test").Page) {
  const passkeyInitial = {
    aaguid: "00000000-0000-0000-0000-000000000001",
    backedUp: true,
    createdAt: 1_777_000_000_000,
    deviceType: "multiDevice",
    id: "composition-passkey",
    lastUsedAt: 1_777_000_100_000,
    revokedAt: null,
    transports: ["internal"],
  }
  const identityInitial = {
    createdAt: 1_777_000_000_000,
    displayName: "Customer user",
    email: "user@customer.example",
    emailVerified: true,
    externalSubject: "composition-github-subject",
    id: "composition-identity",
    providerId: "github",
    providerType: "github",
    realmId,
    updatedAt: 1_777_000_000_000,
    userId: "01900000-0000-7000-8000-0000000000b1",
    username: "customer-user",
    version: 1,
  }
  let passkeys = [passkeyInitial]
  let identities = [identityInitial]
  let totpEnrolled = true
  let recoveryGeneratedAt = 1_777_000_000_000
  let recoveryRemaining = 7

  const reset = () => {
    passkeys = [passkeyInitial]
    identities = [identityInitial]
    totpEnrolled = true
    recoveryGeneratedAt = 1_777_000_000_000
    recoveryRemaining = 7
  }
  const methodsGet = () => ({
    emailOtp: { available: true },
    password: { available: true },
    passkeys: { credentials: passkeys },
    recoveryCodes: { available: true, generatedAt: recoveryGeneratedAt, remaining: recoveryRemaining },
    totp: {
      enrolled: totpEnrolled,
      enrollments: totpEnrolled
        ? [
            {
              confirmedAt: 1_777_000_000_000,
              id: "composition-totp",
              label: "Authenticator app",
              status: "active",
            },
          ]
        : [],
    },
  })

  await page.addInitScript(() => {
    const rawId = new Uint8Array([1, 2, 3]).buffer
    const response = {
      attestationObject: new Uint8Array([4, 5, 6]).buffer,
      clientDataJSON: new Uint8Array([7, 8, 9]).buffer,
      getTransports: () => ["internal"],
    }
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: async () => ({
          authenticatorAttachment: "platform",
          getClientExtensionResults: () => ({}),
          id: "composition-passkey-added",
          rawId,
          response,
          type: "public-key",
        }),
      },
    })
  })
  await productionAccountSessionBootstrap(page)
  await page.route(`**/realms/${realmId}/sessions/csrf`, (route) =>
    route.fulfill({ json: { csrfToken: "composition-csrf-token" } }),
  )
  await page.route(`**/realms/${realmId}/me/authentication-methods`, (route) => route.fulfill({ json: methodsGet() }))
  await page.route(`**/realms/${realmId}/passkeys`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { items: passkeys } })
    const credentialId = (route.request().postDataJSON() as { credentialId: string }).credentialId
    const revoked = passkeys.find((credential) => credential.id === credentialId) ?? passkeyInitial
    passkeys = passkeys.filter((credential) => credential.id !== credentialId)
    return route.fulfill({ json: { credential: { ...revoked, revokedAt: 1_777_100_000_000 } } })
  })
  await page.route(`**/realms/${realmId}/passkeys/registration/start`, (route) =>
    route.fulfill({
      json: {
        options: {
          attestation: "none",
          challenge: "AQID",
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          rp: { id: "127.0.0.1", name: "Authworks" },
          user: { displayName: "Customer user", id: "AQID", name: "customer-user" },
        },
        token: "composition-passkey-registration-token-1234567890",
      },
    }),
  )
  await page.route(`**/realms/${realmId}/passkeys/registration/complete`, (route) => {
    const credential = { ...passkeyInitial, id: "composition-passkey-added" }
    passkeys = [credential]
    return route.fulfill({ json: { credential } })
  })
  await page.route(`**/realms/${realmId}/me/external-identities`, (route) =>
    route.fulfill({ json: { items: identities } }),
  )
  await page.route(`**/realms/${realmId}/me/external-identity-providers`, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            allowAccountCreation: true,
            clientId: "composition-google-client",
            createdAt: 1_777_000_000_000,
            displayName: "Google",
            enabled: true,
            id: "google",
            realmId,
            redirectUri: "https://auth.example.test/callback",
            scopes: ["openid"],
            type: "google",
            updatedAt: 1_777_000_000_000,
            version: 1,
          },
        ],
      },
    }),
  )
  await page.route(`**/realms/${realmId}/me/external-identities/github/composition-github-subject`, (route) => {
    identities = []
    return route.fulfill({ json: { removed: true } })
  })
  await page.route(`**/realms/${realmId}/mfa/recovery-codes`, (route) => {
    recoveryGeneratedAt = 1_777_100_000_000
    recoveryRemaining = 8
    return route.fulfill({ json: { codes: ["COMPOSE-API1", "COMPOSE-API2"], generatedAt: recoveryGeneratedAt } })
  })
  await page.route(`**/realms/${realmId}/mfa/totp`, (route) => {
    totpEnrolled = false
    return route.fulfill({ json: { removed: true } })
  })
  await page.route(`**/realms/${realmId}/mfa/totp/enroll`, (route) =>
    route.fulfill({
      json: {
        enrollment: {
          confirmedAt: null,
          id: "composition-totp-new",
          label: "Authenticator app",
          status: "pending",
          userId: "01900000-0000-7000-8000-0000000000b1",
        },
        otpauthUri: "otpauth://totp/Authworks:user?secret=JBSWY3DPEHPK3PXP&issuer=Authworks",
        secret: "JBSWY3DPEHPK3PXP",
      },
    }),
  )

  return { reset }
}
