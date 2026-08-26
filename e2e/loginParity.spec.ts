import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const viewports = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
] as const

const axeRoutes = [
  "/demo/login/chooser",
  "/demo/login/password?state=error",
  "/demo/login/email-otp/code",
  "/demo/login/mfa",
  "/demo/login/fatal",
] as const

const geometryRoutes = [
  "/demo/login/chooser",
  "/demo/login/chooser/recent-accounts",
  "/demo/login/password?state=error",
  "/demo/login/mfa",
  "/demo/login/fatal",
] as const

const stateRoutes = [
  { heading: "Choose an account", path: "/demo/login/chooser/recent-accounts" },
  { heading: "Sign in with password", path: "/demo/login/password?state=error" },
  { heading: "Enter your email", path: "/demo/login/email-otp" },
  { heading: "Check your email", path: "/demo/login/email-otp/code" },
  { heading: "Passkey not supported", path: "/demo/login/passkey/unsupported" },
  { heading: "Sign in with a passkey", path: "/demo/login/passkey/permission-denied" },
  { heading: "Sign in with a passkey", path: "/demo/login/passkey/ceremony-failure" },
  { heading: "Sign in with Google", path: "/demo/login/idp" },
  { heading: "Sign in with Google", path: "/demo/login/idp/failure" },
  { heading: "No account linked", path: "/demo/login/idp/account-not-found" },
  { heading: "Could not link account", path: "/demo/login/idp/linking-failed" },
  { heading: "Could not link account", path: "/demo/login/idp/registration-failed" },
  { heading: "2-step verification", path: "/demo/login/mfa" },
  { heading: "Loading 2-step verification options...", path: "/demo/login/mfa/loading" },
  { heading: "2-step verification unavailable", path: "/demo/login/mfa/retry" },
  { heading: "Set up 2-step verification", path: "/demo/login/mfa/enroll" },
  { heading: "Optional 2-step verification", path: "/demo/login/mfa/optional" },
  { heading: "2-step verification satisfied", path: "/demo/login/mfa/satisfied" },
  { heading: "Authenticator code", path: "/demo/login/mfa/totp" },
  { heading: "Email code", path: "/demo/login/mfa/email-otp" },
  { heading: "Set up email codes", path: "/demo/login/mfa/email-otp/enroll" },
  { heading: "Passkey", path: "/demo/login/mfa/passkey" },
  { heading: "Passkey setup unavailable", path: "/demo/login/mfa/passkey/enroll" },
  { heading: "Recovery code", path: "/demo/login/mfa/recovery-code" },
  { heading: "Set up an authenticator app", path: "/demo/login/mfa/totp-enroll" },
  { heading: "Reset your password", path: "/demo/login/password/forgot" },
  { heading: "Check your email", path: "/demo/login/password/forgot/sent" },
  { heading: "This reset link is no longer valid", path: "/demo/login/password/reset/invalid" },
  { heading: "Start sign-in again", path: "/demo/login/fatal" },
  { heading: "Loading sign-in...", path: "/demo/login/loading" },
  { heading: "Continuing sign-in...", path: "/demo/login/continuing" },
] as const

const loginRouteReadyTimeout = 15_000

test.describe("login web UI parity", () => {
  test("representative states preserve stable headings", async ({ page }) => {
    test.setTimeout(120_000)
    for (const route of stateRoutes) {
      const routePage = await page.context().newPage()
      try {
        await routePage.goto(route.path, { waitUntil: "domcontentloaded" })
        await expect(
          routePage.getByRole("heading", { level: 1 }).or(routePage.locator(".login-page-shell")).first(),
        ).toBeVisible({ timeout: loginRouteReadyTimeout })
        await expect(routePage.getByRole("heading", { level: 1, name: route.heading, exact: true })).toBeVisible({
          timeout: loginRouteReadyTimeout,
        })
        await expect(routePage.locator("main")).toBeVisible({ timeout: loginRouteReadyTimeout })
      } finally {
        await routePage.close()
      }
    }
  })

  test("representative states preserve responsive geometry", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      for (const route of geometryRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expect(page.getByRole("heading", { level: 1 }).or(page.locator(".login-page-shell")).first()).toBeVisible(
          {
            timeout: loginRouteReadyTimeout,
          },
        )
        await expect(page.locator("main")).toBeVisible({ timeout: loginRouteReadyTimeout })
        await expect(
          page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        ).resolves.toBe(true)
      }
    }
  })

  test("login preference controls follow the legal copy in normal and unavailable frames", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      for (const route of ["/demo/login/password", "/demo/login/fatal"]) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expect(page.locator("main.login-frame")).toBeVisible({ timeout: loginRouteReadyTimeout })

        const children = await page
          .locator("main.login-frame")
          .evaluate((frame) => [...frame.children].map((child) => child.className))

        if (route === "/demo/login/password") {
          expect(children).toEqual(["login-card", "login-legal", "login-controls"])
        } else {
          expect(children).toEqual(["login-card p-5 sm:p-10", "login-controls"])
        }
      }
    }
  })

  test("chooser and password remember recent identifiers and focus headings after keyboard navigation", async ({
    page,
  }) => {
    await page.goto("/demo/login/chooser/recent-accounts")
    await page.getByRole("button", { name: /alex@acme\.example/ }).press("Enter")

    await expect(page).toHaveURL(/\/demo\/login\/signed-in$/)
    await expect(page.getByRole("heading", { name: "Signed in" })).toBeFocused()
  })

  test("password pending and error states stay in place", async ({ page }) => {
    await page.goto("/demo/login/password")
    await page.getByLabel("Password", { exact: true }).fill("demo-password")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByRole("button", { name: "Signing in...", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Signing in...", exact: true })).toHaveAttribute("aria-busy", "true")

    await page.goto("/demo/login/password?state=error")
    await expect(page.getByRole("alert")).toContainText("Incorrect username or password.")
  })

  test("email OTP masks the destination and exposes resend and error states", async ({ page }) => {
    await page.clock.install()
    await page.goto("/demo/login/email-otp")
    await page.getByLabel("Email address", { exact: true }).fill("alex@acme.example")
    await page.getByRole("button", { name: "Send code", exact: true }).click()
    await page.clock.fastForward(300)

    await expect(page).toHaveURL(/\/demo\/login\/email-otp\/code/)
    await expect(page.getByText(/al\*+@acme\.example/)).toBeVisible()
    const resend = page.getByRole("button", { name: "Send a new code", exact: true })
    await expect(resend).toBeDisabled()
    await page.clock.fastForward(60_001)
    await expect(resend).toBeEnabled()
    await resend.click()
    await page.clock.fastForward(300)
    await expect(page.getByRole("status")).toContainText("A new code has been sent.")

    await page.goto("/demo/login/email-otp?state=error")
    await expect(page.getByRole("alert")).toContainText("The email code could not be sent.")
  })

  test("light, dark, and system theme controls update the document", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/demo/login/password")

    for (const option of [
      { expected: "light", label: "Light" },
      { expected: "dark", label: "Dark" },
      { expected: "dark", label: "System" },
    ]) {
      await page.getByRole("button", { name: option.label, exact: true }).click()
      await expect(page.locator("html")).toHaveAttribute("data-theme", option.expected)
      await expect(page.locator(".login-page-shell")).toHaveAttribute("data-theme", option.expected)
      await expect(page.getByRole("button", { name: option.label, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      )
    }
  })

  test("Arabic login is RTL and remains usable at desktop and mobile sizes", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto("/demo/login/chooser")
      await page.getByRole("combobox").selectOption("ar")

      await expect(page.locator("html")).toHaveAttribute("lang", "ar")
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).resolves.toBe(true)
    }
  })

  test("representative login states have no serious or critical axe violations", async ({ page }) => {
    test.setTimeout(60_000)
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      for (const route of axeRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expect(page.getByRole("heading", { level: 1 }).or(page.locator(".login-page-shell")).first()).toBeVisible(
          {
            timeout: loginRouteReadyTimeout,
          },
        )
        const accessibility = await new AxeBuilder({ page }).analyze()
        expect(
          accessibility.violations.filter(
            (violation) => violation.impact === "serious" || violation.impact === "critical",
          ),
        ).toEqual([])
      }
    }
  })
})
