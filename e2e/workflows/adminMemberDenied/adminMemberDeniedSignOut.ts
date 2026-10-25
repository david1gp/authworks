import { expect } from "../../harness/e2eExpect.js"
import type { AdminMemberDeniedSetup } from "./adminMemberDeniedSetupCreate.js"
import { adminMemberDeniedSignIn } from "./adminMemberDeniedSignIn.js"

/** Signs the member out and verifies the admin area redirects back to login. */
export async function adminMemberDeniedSignOut(setup: AdminMemberDeniedSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/account")
  await page.waitForURL(/\/account|\/login/, { timeout: 30_000 })
  // The guard bounces to /login asynchronously after the session check resolves, so wait
  // for a settled marker: the signed-in account toolbar or the login screen.
  const loginMarker = page.getByRole("heading", { name: "Choose a method" }).or(page.getByLabel("Username or email"))
  await expect(page.getByRole("link", { name: "Sign out" }).first().or(loginMarker)).toBeVisible({ timeout: 30_000 })
  // Orchestrator resume reruns the spec with a fresh browser profile while skipping
  // completed steps, so re-authenticate when the earlier session is gone.
  if (/\/login/.test(page.url())) await adminMemberDeniedSignIn(setup)
  await page.getByRole("link", { name: "Sign out" }).first().click()
  await page.waitForURL(/\/login\/logout/, { timeout: 30_000 })
  // The logout screen confirms before revoking: without this click the session survives
  // and /admin/users keeps rendering instead of redirecting to /login.
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible()
  await page.goto("/admin/users")
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/login/)
}
