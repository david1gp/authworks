import { expect, type Page, type Route, test } from "@playwright/test"
import { productionAccountSessionBootstrap } from "./productionAccountSessionBootstrap.js"

const realmId = "01900000-0000-7000-8000-000000000001"
const userId = "01900000-0000-7000-8000-0000000000b1"

const user = {
  createdAt: 1_774_000_000_000,
  email: "avery.stone@example.com",
  emailVerified: true,
  emailVerifiedAt: 1_774_000_060_000,
  id: userId,
  profile: {
    displayName: "Avery Stone",
    firstName: "Avery",
    gender: "unspecified",
    lastName: "Stone",
    nickName: "Avery",
    picture: { contentType: "image/png", url: "https://assets.example.com/avery-stone.png" },
    preferredLanguage: "en",
  },
  realmId,
  state: "active",
  updatedAt: 1_774_000_060_000,
  userName: "avery.stone",
  verificationState: "verified",
}

test("demo account pages are interactive and network-free", async ({ page }) => {
  const apiRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/realms/")) apiRequests.push(request.url())
  })

  await page.goto("/demo/account/profile")
  await expect(page.getByRole("heading", { name: "Personal information" })).toBeVisible()
  await page.getByLabel("Display name", { exact: true }).fill("Avery Example")
  await page.getByRole("button", { name: "Unspecified", exact: true }).click()
  await page.getByRole("option", { name: "Woman", exact: true }).click()
  await expect(
    page.getByText(
      "Optional preferred or short name shared in the OIDC nickname claim; display name is shown in the account UI.",
      { exact: true },
    ),
  ).toBeVisible()
  await page.getByLabel("Picture URL").fill("https://assets.example.com/avery-example.png")
  await page.getByLabel("Picture content type").fill("image/png")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Your profile was saved.")).toBeVisible()
  await page.getByRole("button", { name: "Remove picture" }).click()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByLabel("Picture URL")).toHaveValue("")

  await page.goto("/demo/account/password")
  await page.getByLabel("Current password").fill("fixture-current")
  await page.getByLabel("New password", { exact: true }).fill("new-password")
  await page.getByLabel("Confirm new password").fill("new-password")
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("Your password was changed.")).toBeVisible()

  await page.goto("/demo/account/delete")
  await page.getByLabel(/Enter .* to confirm/).fill("not-the-email")
  await page.getByRole("button", { name: "Delete account permanently" }).click()
  await expect(page.getByText("The email address does not match.")).toBeVisible()
  expect(apiRequests).toEqual([])
})

test("production profile uses the subject API and CSRF", async ({ page }) => {
  let csrfHeader: string | null = null
  const profileUpdates: unknown[] = []
  let currentUser = user
  await productionAccountSessionBootstrap(page)
  await accountApiRoutesInstall(page, async (route, method) => {
    if (method === "PATCH") {
      csrfHeader = route.request().headers()["x-csrf-token"] ?? null
      const body = route.request().postDataJSON()
      profileUpdates.push(body)
      const profile = { ...currentUser.profile, ...body }
      if (body.picture === null) delete profile.picture
      currentUser = { ...currentUser, profile }
      await route.fulfill({ json: { user: currentUser } })
      return
    }
    await route.fulfill({ json: { user: currentUser } })
  })

  await page.goto("/account/profile")
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Avery Stone")
  await expect(page.getByRole("button", { name: "Unspecified", exact: true })).toBeVisible()
  await expect(page.getByLabel("Picture URL")).toHaveValue("https://assets.example.com/avery-stone.png")
  await page.getByLabel("Display name", { exact: true }).fill("Avery Updated")
  await page.getByRole("button", { name: "Unspecified", exact: true }).click()
  await page.getByRole("option", { name: "Woman", exact: true }).click()
  await page.getByLabel("Picture URL").fill("https://assets.example.com/avery-updated.png")
  await page.getByLabel("Picture content type").fill("image/png")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Your profile was saved.")).toBeVisible()
  await page.getByRole("button", { name: "Remove picture" }).click()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByLabel("Picture URL")).toHaveValue("")
  expect(csrfHeader).toBe("e2e-csrf-token")
  expect(profileUpdates).toEqual([
    {
      displayName: "Avery Updated",
      firstName: "Avery",
      gender: "woman",
      lastName: "Stone",
      nickName: "Avery",
      picture: { contentType: "image/png", url: "https://assets.example.com/avery-updated.png" },
      preferredLanguage: "en",
    },
    {
      displayName: "Avery Updated",
      firstName: "Avery",
      gender: "woman",
      lastName: "Stone",
      nickName: "Avery",
      picture: null,
      preferredLanguage: "en",
    },
  ])
})

test("production profile adds, verifies, and changes its WhatsApp phone number", async ({ page }) => {
  const firstPhoneNumber = "+14155552671"
  const replacementPhoneNumber = "+14155552672"
  const startChallengeId = "01900000-0000-7000-8000-0000000000c1"
  const resendChallengeId = "01900000-0000-7000-8000-0000000000c2"
  const replacementChallengeId = "01900000-0000-7000-8000-0000000000c3"
  let currentUser: typeof user & { phoneNumber?: string; phoneNumberVerifiedAt?: number } = user
  let startCount = 0
  let verifyCount = 0
  const phoneChangeRequests: Array<{ body: unknown; csrf: string | undefined; method: string; path: string }> = []

  await productionAccountSessionBootstrap(page)
  await accountApiRoutesInstall(page, async (route, method) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/phone-change/start") || pathname.endsWith("/phone-change/resend")) {
      phoneChangeRequests.push({
        body: request.postDataJSON(),
        csrf: request.headers()["x-csrf-token"],
        method,
        path: pathname,
      })
      if (pathname.endsWith("/phone-change/start")) startCount += 1
      await route.fulfill({
        json: {
          accepted: true,
          challengeId: pathname.endsWith("/resend")
            ? resendChallengeId
            : startCount === 1
              ? startChallengeId
              : replacementChallengeId,
          expiresAt: 1_774_000_360_000,
          retryAt: 1_774_000_120_000,
        },
      })
      return
    }
    if (pathname.endsWith("/phone-change/verify")) {
      phoneChangeRequests.push({
        body: request.postDataJSON(),
        csrf: request.headers()["x-csrf-token"],
        method,
        path: pathname,
      })
      verifyCount += 1
      if (verifyCount === 2) {
        await route.fulfill({
          json: {
            error: {
              code: "whatsapp-otp.invalid",
              message: "The account phone-change code is invalid.",
              op: "whatsappOtpPhoneChangeVerify",
              retryable: true,
              status: 400,
            },
          },
          status: 400,
        })
        return
      }
      currentUser = {
        ...currentUser,
        phoneNumber: verifyCount === 1 ? firstPhoneNumber : replacementPhoneNumber,
        phoneNumberVerifiedAt: 1_774_000_120_000,
        updatedAt: 1_774_000_120_000,
      }
      await route.fulfill({ json: { user: currentUser } })
      return
    }
    await route.fulfill({ json: { user: currentUser } })
  })

  await page.goto("/account/profile")
  const phoneSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "WhatsApp phone number" }) })
  await expect(phoneSection.getByText("No verified phone number added", { exact: true })).toBeVisible()
  await phoneSection.getByLabel("WhatsApp phone number").fill(firstPhoneNumber)
  await phoneSection.getByRole("button", { name: "Add phone number" }).click()
  await expect(
    phoneSection.getByText(`Enter the code sent to ${firstPhoneNumber} on WhatsApp.`, { exact: true }),
  ).toBeVisible()
  await expect(phoneSection.getByLabel("Six-digit verification code")).toBeVisible()

  await phoneSection.getByRole("button", { name: "Resend code" }).click()
  await expect(phoneSection.getByLabel("Six-digit verification code")).toBeVisible()
  await phoneSection.getByLabel("Six-digit verification code").fill("123456")
  await phoneSection.getByRole("button", { name: "Verify phone number" }).click()
  await expect(phoneSection.getByText("Your verified phone number was updated.", { exact: true })).toBeVisible()
  await expect(phoneSection.getByText(firstPhoneNumber, { exact: true })).toBeVisible()
  await expect(phoneSection.getByText("Verified", { exact: true })).toBeVisible()

  await phoneSection.getByLabel("New phone number").fill(replacementPhoneNumber)
  await phoneSection.getByRole("button", { name: "Change phone number" }).click()
  await expect(
    phoneSection.getByText(`Enter the code sent to ${replacementPhoneNumber} on WhatsApp.`, { exact: true }),
  ).toBeVisible()
  await expect(phoneSection.getByText(firstPhoneNumber, { exact: true })).toBeVisible()
  await phoneSection.getByLabel("Six-digit verification code").fill("654321")
  await phoneSection.getByRole("button", { name: "Verify phone number" }).click()
  await expect(phoneSection.getByText("The account phone-change code is invalid.", { exact: true })).toBeVisible()
  await expect(phoneSection.getByText(firstPhoneNumber, { exact: true })).toBeVisible()
  await expect(phoneSection.getByText(replacementPhoneNumber, { exact: true })).toHaveCount(0)

  await phoneSection.getByLabel("Six-digit verification code").fill("654322")
  await phoneSection.getByRole("button", { name: "Verify phone number" }).click()
  await expect(phoneSection.getByText("Your verified phone number was updated.", { exact: true })).toBeVisible()
  await expect(phoneSection.getByText(replacementPhoneNumber, { exact: true })).toBeVisible()
  await expect(phoneSection.getByText(firstPhoneNumber, { exact: true })).toHaveCount(0)
  await expect(phoneSection.getByText("Verified", { exact: true })).toBeVisible()
  expect(phoneChangeRequests).toEqual([
    {
      body: { phoneNumber: firstPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/start`,
    },
    {
      body: { challengeId: startChallengeId, phoneNumber: firstPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/resend`,
    },
    {
      body: { challengeId: resendChallengeId, code: "123456", phoneNumber: firstPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/verify`,
    },
    {
      body: { phoneNumber: replacementPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/start`,
    },
    {
      body: { challengeId: replacementChallengeId, code: "654321", phoneNumber: replacementPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/verify`,
    },
    {
      body: { challengeId: replacementChallengeId, code: "654322", phoneNumber: replacementPhoneNumber },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/phone-change/verify`,
    },
  ])
})

test("production email addresses use the lifecycle APIs and protect the primary address", async ({ page }) => {
  const primaryEmailId = "email-primary"
  const secondaryEmailId = "email-secondary"
  const challengeId = "email-address-challenge"
  const requests: { body?: unknown; csrf: string | null; method: string; path: string }[] = []
  let addresses = [
    {
      createdAt: 1_774_000_000_000,
      email: user.email,
      id: primaryEmailId,
      isPrimary: true,
      updatedAt: 1_774_000_060_000,
      verified: true,
      verifiedAt: 1_774_000_060_000,
      version: 1,
    },
  ]
  await productionAccountSessionBootstrap(page)
  await accountApiRoutesInstall(page, async (route, method) => {
    const path = new URL(route.request().url()).pathname
    if (path === `/realms/${realmId}/me`) {
      await route.fulfill({ json: { user } })
      return
    }
    if (path === `/realms/${realmId}/me/emails` && method === "GET") {
      await route.fulfill({ json: { items: addresses } })
      return
    }
    requests.push({
      ...(method === "POST" ? { body: route.request().postDataJSON() } : {}),
      csrf: route.request().headers()["x-csrf-token"] ?? null,
      method,
      path,
    })
    if (path.endsWith("/add/start") || path.endsWith("/add/resend")) {
      await route.fulfill({
        json: { accepted: true, challengeId, expiresAt: 1_800_000_300_000, retryAt: 1_800_000_060_000 },
      })
      return
    }
    if (path.endsWith("/add/verify")) {
      const secondary = {
        createdAt: 1_774_000_120_000,
        email: "avery.secondary@example.com",
        id: secondaryEmailId,
        isPrimary: false,
        updatedAt: 1_774_000_120_000,
        verified: true,
        verifiedAt: 1_774_000_120_000,
        version: 1,
      }
      addresses = [...addresses, secondary]
      await route.fulfill({ json: { email: secondary } })
      return
    }
    if (path.endsWith(`/${secondaryEmailId}/primary`)) {
      addresses = addresses.map((address) => ({ ...address, isPrimary: address.id === secondaryEmailId }))
      await route.fulfill({ json: { email: addresses.find((address) => address.id === secondaryEmailId) } })
      return
    }
    if (path.endsWith(`/${primaryEmailId}`) && method === "DELETE") {
      addresses = addresses.filter((address) => address.id !== primaryEmailId)
      await route.fulfill({ json: { removed: true } })
      return
    }
    await route.abort()
  })

  await page.goto("/account/email")
  const primaryRow = page.getByRole("listitem").filter({ hasText: user.email })
  await expect(primaryRow.getByText("Primary", { exact: true })).toBeVisible()
  await expect(primaryRow.getByRole("button", { name: "Remove", exact: true })).toBeDisabled()

  await page.getByLabel("New email address").fill("avery.secondary@example.com")
  await page.getByRole("button", { name: "Add email address", exact: true }).click()
  await page.getByRole("button", { name: "Resend verification email", exact: true }).click()
  await page.getByLabel("Verification token").fill("production-email-address-token-0000000000")
  await page.getByRole("button", { name: "Verify email address", exact: true }).click()

  const secondaryRow = page.getByRole("listitem").filter({ hasText: "avery.secondary@example.com" })
  await expect(secondaryRow.getByText("Verified", { exact: true })).toBeVisible()
  await secondaryRow.getByRole("button", { name: "Make primary", exact: true }).click()
  await expect(secondaryRow.getByText("Primary", { exact: true })).toBeVisible()
  await primaryRow.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(primaryRow).toHaveCount(0)
  expect(requests).toEqual([
    {
      body: { email: "avery.secondary@example.com" },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/emails/add/start`,
    },
    {
      body: { challengeId, email: "avery.secondary@example.com" },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/emails/add/resend`,
    },
    {
      body: { challengeId, token: "production-email-address-token-0000000000" },
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/emails/add/verify`,
    },
    {
      body: {},
      csrf: "e2e-csrf-token",
      method: "POST",
      path: `/realms/${realmId}/me/emails/${secondaryEmailId}/primary`,
    },
    {
      csrf: "e2e-csrf-token",
      method: "DELETE",
      path: `/realms/${realmId}/me/emails/${primaryEmailId}`,
    },
  ])
})

test("production password presents an API rejection", async ({ page }) => {
  await productionAccountSessionBootstrap(page)
  await accountApiRoutesInstall(page, async (route, method) => {
    if (method === "POST") {
      await route.fulfill({
        json: {
          error: {
            code: "passwords.invalid-credentials",
            message: "The current password is incorrect.",
            op: "passwordChange",
            retryable: false,
            status: 401,
          },
        },
        status: 401,
      })
      return
    }
    await route.fulfill({ json: { user } })
  })

  await page.goto("/account/password")
  await page.getByLabel("Current password").fill("wrong-password")
  await page.getByLabel("New password", { exact: true }).fill("new-password")
  await page.getByLabel("Confirm new password").fill("new-password")
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("The current password is incorrect.")).toBeVisible()
})

async function accountApiRoutesInstall(page: Page, accountRoute: (route: Route, method: string) => Promise<void>) {
  await page.route(`**/realms/${realmId}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (
      pathname === `/realms/${realmId}` ||
      pathname.endsWith("/sessions/current") ||
      pathname.endsWith("/me/organizations")
    ) {
      await route.fallback()
      return
    }
    if (route.request().url().endsWith("/sessions/csrf")) {
      await route.fulfill({ json: { csrfToken: "e2e-csrf-token" } })
      return
    }
    await accountRoute(route, route.request().method())
  })
}
