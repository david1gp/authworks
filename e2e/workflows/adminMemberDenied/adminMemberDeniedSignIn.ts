import { expect } from "../../harness/e2eExpect.js"
import type { AdminMemberDeniedSetup } from "./adminMemberDeniedSetupCreate.js"

/**
 * Signs the plain member in through the hosted login and verifies the role-aware landing:
 * members without `return_to` land on `/account`, not `/admin/users`. Note the member may
 * belong to several organizations; sign-in uses discovery (Authworks Dev) so navigation
 * settles deterministically before assertions run.
 */
export async function adminMemberDeniedSignIn(setup: AdminMemberDeniedSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/login/password")
  await page.getByLabel("Username or email").fill(setup.memberUserName)
  await page.getByLabel("Password", { exact: true }).fill(setup.memberPassword)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/account/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0)
}
