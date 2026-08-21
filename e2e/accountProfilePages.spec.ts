import { expect, type Page, type Route, test } from "@playwright/test"

const user = {
  createdAt: 1_774_000_000_000,
  email: "avery.stone@example.com",
  emailVerified: true,
  emailVerifiedAt: 1_774_000_060_000,
  id: "019c1234-5678-7abc-8def-0123456789ab",
  profile: {
    displayName: "Avery Stone",
    firstName: "Avery",
    lastName: "Stone",
    nickName: "Avery",
    preferredLanguage: "en",
  },
  realmId: "019c1234-5678-7abc-8def-1123456789ab",
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
  await page.getByLabel("Display name").fill("Avery Example")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Your profile was saved.")).toBeVisible()

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
  await accountApiRoutesInstall(page, async (route, method) => {
    if (method === "PATCH") {
      csrfHeader = route.request().headers()["x-csrf-token"] ?? null
      const body = route.request().postDataJSON()
      await route.fulfill({ json: { user: { ...user, profile: { ...user.profile, ...body } } } })
      return
    }
    await route.fulfill({ json: { user } })
  })

  await page.goto("/account/profile")
  await expect(page.getByLabel("Display name")).toHaveValue("Avery Stone")
  await page.getByLabel("Display name").fill("Avery Updated")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Your profile was saved.")).toBeVisible()
  expect(csrfHeader).toBe("e2e-csrf-token")
})

test("production password presents an API rejection", async ({ page }) => {
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
  await page.route("**/realms/customer-identity/**", async (route) => {
    if (route.request().url().endsWith("/sessions/csrf")) {
      await route.fulfill({ json: { csrfToken: "e2e-csrf-token" } })
      return
    }
    await accountRoute(route, route.request().method())
  })
}
