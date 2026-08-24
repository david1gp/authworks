import { expect, test } from "@playwright/test"
import { demoLoginScenarioGroups } from "../src/features/demo/demoLoginScenarioGroups.js"

const demoDestinations = demoLoginScenarioGroups.flatMap((group) => group.scenarios)
const loginRouteReadyTimeout = 15_000

test("every demo login destination renders without a backend, auth, or console error", async ({ page }) => {
  test.setTimeout(180_000)
  const consoleErrors: string[] = []
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()))
  page.on("pageerror", (error) => consoleErrors.push(error.message))
  // Fail the run if any demo page attempts a real API call. The pattern is anchored to the origin
  // so Vite module URLs such as /src/features/realms/... are never matched.
  const apiRequests: string[] = []
  await page.route(/^https?:\/\/[^/]+\/(?:realms\/|organization-discovery|oauth2\/)/, async (route) => {
    apiRequests.push(route.request().url())
    await route.abort()
  })

  for (const destination of demoDestinations) {
    await page.goto(destination.path, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { level: 1 }).or(page.locator(".login-page-shell")).first()).toBeVisible({
      timeout: loginRouteReadyTimeout,
    })
  }

  expect(apiRequests).toEqual([])
  expect(consoleErrors).toEqual([])
})

test("the login directory lists every scenario group and opens a destination", async ({ page }) => {
  await page.goto("/demo/login")

  await expect(page.getByRole("heading", { name: "Login demo" })).toBeVisible()
  for (const group of [
    "Start sign-in",
    "Password and email code",
    "Registration and verification",
    "Passwordless and external",
    "Multi-factor authentication",
    "Recovery",
    "Interaction and logout",
    "Shared states",
  ])
    await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Password", exact: true }).first().click()
  await expect(page).toHaveURL(/\/demo\/login\/password$/)
})

test("the password panel uses the source heading and navigation copy without an intro", async ({ page }) => {
  await page.goto("/demo/login/password")

  await expect(page.getByRole("heading", { name: "Sign in with password" })).toBeVisible()
  await expect(page.getByText(/Enter the credentials for your Acme account\./)).toBeHidden()
  await expect(page.getByRole("button", { name: "Back to methods", exact: true })).toBeVisible()
})

test("the demo password flow succeeds and resumes the interaction", async ({ page }) => {
  await page.goto("/demo/login/password")

  await expect(page.getByLabel("Username or email")).toHaveValue("alex@acme.example")
  await expect(page.getByLabel("Remember this identifier")).toBeChecked()
  await page.getByLabel("Password", { exact: true }).fill("demo-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible()
})

test("the demo password error state reports invalid credentials in place", async ({ page }) => {
  await page.goto("/demo/login/password?state=error")

  await expect(page.getByRole("alert")).toContainText("Incorrect username or password.")
  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("wrong-password")

  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Incorrect username or password.")
  await expect(page).toHaveURL(/\/demo\/login\/password\?state=error$/)
})

test("the demo password submit exposes its pending state before completion", async ({ page }) => {
  await page.goto("/demo/login/password")
  await page.getByLabel("Password", { exact: true }).fill("demo-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  const pendingButton = page.getByRole("button", { name: "Signing in...", exact: true })
  await expect(pendingButton).toBeDisabled()
  await expect(pendingButton).toHaveAttribute("aria-busy", "true")
  await expect(page.getByLabel("Username or email")).toBeDisabled()
  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("selecting a recent password account checks remembered identifier", async ({ page }) => {
  await page.goto("/demo/login/chooser/recent-accounts")
  await page.getByRole("button", { name: /alex@acme\.example/ }).click()

  await expect(page.getByLabel("Username or email")).toHaveValue("alex@acme.example")
  await expect(page.getByLabel("Remember this identifier")).toBeChecked()
})

test("client-side validation runs before any adapter call", async ({ page }) => {
  await page.goto("/demo/login/password")
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled()

  await page.goto("/demo/login/register")
  await page.getByLabel("Email address", { exact: true }).fill("not-an-email")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("alert")).toContainText("Enter a valid email address.")
})

test("a second-factor challenge routes the demo sign-in to verification", async ({ page }) => {
  await page.goto("/demo/login/password?state=expired")

  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("demo-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/login\/mfa/)
  await expect(page.getByRole("heading", { name: "2-step verification" })).toBeVisible()

  await page.getByRole("button", { name: "Authenticator app" }).click()
  await expect(page).toHaveURL(/\/demo\/login\/mfa\/totp/)
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Verify", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("the email code flow advances from address to code entry", async ({ page }) => {
  await page.goto("/demo/login/email-otp")

  await page.getByLabel("Email address", { exact: true }).fill("alex@acme.example")
  await page.getByRole("button", { name: "Send code", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/login\/email-otp\/code/)
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("recovery request and reset reach their non-disclosing confirmations", async ({ page }) => {
  await page.goto("/demo/login/password/forgot")
  await page.getByLabel("Email address", { exact: true }).fill("alex@acme.example")
  await page.getByRole("button", { name: "Send reset link", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/login\/password\/forgot\/sent$/)
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()

  await page.goto("/demo/login/password/reset")
  const resetForm = page.locator("form").filter({ has: page.locator("#login-reset-password") })
  await resetForm.getByLabel("New password", { exact: true }).fill("new-demo-password")
  await resetForm.getByLabel("Confirm new password", { exact: true }).fill("new-demo-password")
  await resetForm.getByRole("button", { name: "Set new password", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Your password was changed", exact: true })).toBeVisible()
})

test("mismatched passwords are rejected before submission", async ({ page }) => {
  await page.goto("/demo/login/password/reset")
  const resetForm = page.locator("form").filter({ has: page.locator("#login-reset-password") })
  await resetForm.getByLabel("New password", { exact: true }).fill("new-demo-password")
  await resetForm.getByLabel("Confirm new password", { exact: true }).fill("different-password")
  await resetForm.getByRole("button", { name: "Set new password", exact: true }).click()

  await expect(page.getByRole("alert")).toContainText("The passwords do not match.")
})

test("the authenticator enrollment key is only shown after the setup is started", async ({ page }) => {
  await page.goto("/demo/login/mfa/totp-enroll")

  const secretValue = page.locator('p[aria-describedby="totp-secret-label"]')
  await expect(secretValue).toBeHidden()
  await page.getByRole("button", { name: "Show setup key", exact: true }).click()
  await expect(page.getByRole("button", { name: "Show setup key", exact: true })).toBeVisible()
  await expect(secretValue).toBeHidden()
  await page.getByRole("button", { name: "Show setup key", exact: true }).click()
  await expect(page.getByRole("group").filter({ has: page.locator("#totp-secret-label") })).toBeVisible()
  await expect(secretValue).toBeVisible()
  await expect(secretValue.locator("span")).toHaveText(["JBSW", "Y3DP", "EHPK", "3PXP"])

  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Finish setup" }).click()
  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("the recovery-code factor accepts a saved code", async ({ page }) => {
  await page.goto("/demo/login/mfa/recovery-code")

  await page.getByLabel("Recovery code").fill("AX7K-2QPL")
  await page.getByRole("button", { name: "Verify", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("the fixture state selector switches every state from the URL", async ({ page }) => {
  await page.goto("/demo/login/chooser?state=empty")
  await expect(page.getByRole("heading", { name: "Choose a method", exact: true })).toBeVisible()

  await page.goto("/demo/login/chooser?state=success")
  await expect(page.getByRole("button", { name: /alex@acme.example/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /Email code/ })).toBeVisible()

  await page.goto("/demo/login/loading")
  await expect(page.getByRole("status")).toContainText("Loading sign-in...")
})

test("logout confirms and reports a completed sign-out", async ({ page }) => {
  await page.goto("/demo/login/logout")

  await page.getByRole("button", { name: "Sign out", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible()
})

test("the passkey panel explains unsupported devices without offering the ceremony", async ({ page }) => {
  await page.goto("/demo/login/passkey?state=permission-denied")

  await expect(page.getByText("This browser or device cannot use passkeys.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeHidden()
})

test("the MFA passkey challenge uses the reference heading and action casing", async ({ page }) => {
  await page.goto("/demo/login/mfa/passkey")

  await expect(page.getByRole("heading", { name: "Passkey", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Verify with Passkey", exact: true })).toBeVisible()
})
