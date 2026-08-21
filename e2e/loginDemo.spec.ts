import { expect, test } from "@playwright/test"

const demoDestinations = [
  { heading: "Sign in", path: "/demo/login/chooser" },
  { heading: "Choose an account", path: "/demo/login/chooser/recent-accounts" },
  { heading: "Enter your password", path: "/demo/login/password" },
  { heading: "Enter your password", path: "/demo/login/password/error" },
  { heading: "Update your password", path: "/demo/login/password/change-required" },
  { heading: "Create your account", path: "/demo/login/register" },
  { heading: "Confirm your email address", path: "/demo/login/register/done" },
  { heading: "Verify your email address", path: "/demo/login/verify-email" },
  { heading: "Sign in with an email code", path: "/demo/login/email-otp" },
  { heading: "Enter your email code", path: "/demo/login/email-otp/code" },
  { heading: "Sign in with a passkey", path: "/demo/login/passkey" },
  { heading: "Sign in with a passkey", path: "/demo/login/passkey/unsupported" },
  { heading: "Continue with Google", path: "/demo/login/idp" },
  { heading: "Continue with Google", path: "/demo/login/idp/failure" },
  { heading: "2-step verification", path: "/demo/login/mfa" },
  { heading: "Authenticator app", path: "/demo/login/mfa/totp" },
  { heading: "Email code", path: "/demo/login/mfa/email-otp" },
  { heading: "Sign in with a passkey", path: "/demo/login/mfa/passkey" },
  { heading: "Recovery code", path: "/demo/login/mfa/recovery-code" },
  { heading: "Set up an authenticator app", path: "/demo/login/mfa/totp-enroll" },
  { heading: "Reset your password", path: "/demo/login/password/forgot" },
  { heading: "Check your email", path: "/demo/login/password/forgot/sent" },
  { heading: "Set a new password", path: "/demo/login/password/reset" },
  { heading: "Password updated", path: "/demo/login/password/reset/complete" },
  { heading: "Signed in", path: "/demo/login/signed-in" },
  { heading: "Sign out of Acme", path: "/demo/login/logout" },
  { heading: "Signed out", path: "/demo/login/logout/done" },
  { heading: "Sign-in unavailable", path: "/demo/login/unsupported" },
]

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
    await page.goto(destination.path)
    await expect(page.getByRole("heading", { level: 1, name: destination.heading })).toBeVisible()
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

test("the demo password flow succeeds and resumes the interaction", async ({ page }) => {
  await page.goto("/demo/login/password")

  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("demo-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible()
})

test("the demo password error state reports invalid credentials in place", async ({ page }) => {
  await page.goto("/demo/login/password/error")

  await page.getByLabel("Username or email").fill("alex@acme.example")
  await page.getByLabel("Password", { exact: true }).fill("wrong-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("alert")).toContainText("The identifier or password is incorrect.")
  await expect(page).toHaveURL(/\/demo\/login\/password\/error$/)
})

test("client-side validation runs before any adapter call", async ({ page }) => {
  await page.goto("/demo/login/password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Enter your username and password.")

  await page.goto("/demo/login/register")
  await page.getByLabel("Email address").fill("not-an-email")
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

  await page.getByLabel("Email address").fill("alex@acme.example")
  await page.getByRole("button", { name: "Send code" }).click()

  await expect(page).toHaveURL(/\/demo\/login\/email-otp\/code/)
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Verify code" }).click()
  await expect(page).toHaveURL(/\/demo\/login\/signed-in/)
})

test("recovery request and reset reach their non-disclosing confirmations", async ({ page }) => {
  await page.goto("/demo/login/password/forgot")
  await page.getByLabel("Email address").fill("alex@acme.example")
  await page.getByRole("button", { name: "Send recovery instructions" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()

  await page.goto("/demo/login/password/reset")
  await page.getByLabel("New password").fill("new-demo-password")
  await page.getByLabel("Confirm password").fill("new-demo-password")
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible()
})

test("mismatched passwords are rejected before submission", async ({ page }) => {
  await page.goto("/demo/login/password/reset")
  await page.getByLabel("New password").fill("new-demo-password")
  await page.getByLabel("Confirm password").fill("different-password")
  await page.getByRole("button", { name: "Update password" }).click()

  await expect(page.getByRole("alert")).toContainText("The passwords do not match.")
})

test("the authenticator enrollment key is only shown after the setup is started", async ({ page }) => {
  await page.goto("/demo/login/mfa/totp-enroll")

  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeHidden()
  await page.getByRole("button", { name: "Show setup key" }).click()
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible()

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
  await page.goto("/demo/login/chooser/recent-accounts?state=empty")
  await expect(page.getByText("No active sessions")).toBeVisible()

  await page.goto("/demo/login/chooser/recent-accounts?state=success")
  await expect(page.getByRole("button", { name: /alex@acme.example/ })).toBeVisible()

  await page.goto("/demo/login/loading")
  await expect(page.getByRole("status")).toContainText("Preparing sign-in")
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
