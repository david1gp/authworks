import { expect, test } from "@playwright/test"

test("the login directory opens the password scenario", async ({ page }) => {
  await page.goto("/demo/login")

  await expect(page.getByRole("heading", { name: "Password", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Email OTP", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "MFA", exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Password", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/login\/password$/)
  await expect(page.getByRole("heading", { name: "Sign in with password", exact: true })).toBeVisible()

  await page.getByLabel("Email or username").fill("alex@example.com")
  await page.getByLabel("Password", { exact: true }).fill("demo-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("status")).toHaveText("Demo submission completed successfully.")
})

test("the password error scenario shows invalid credentials", async ({ page }) => {
  await page.goto("/demo/login/password/error")

  await page.getByLabel("Email or username").fill("alex@example.com")
  await page.getByLabel("Password", { exact: true }).fill("wrong-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("The identifier or password is incorrect.")
})

test("the login method chooser and email form render", async ({ page }) => {
  await page.goto("/demo/login/chooser")
  await expect(page.getByRole("heading", { name: "Choose a method", exact: true })).toBeVisible()

  await page.goto("/demo/login/email-otp")
  await expect(page.getByRole("heading", { name: "Sign in with email code", exact: true })).toBeVisible()
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
})
