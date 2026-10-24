import { expect } from "../../harness/e2eExpect.js"
import type { AdminMemberDeniedSetup } from "./adminMemberDeniedSetupCreate.js"

/** Signs the member out and verifies the admin area redirects back to login. */
export async function adminMemberDeniedSignOut(setup: AdminMemberDeniedSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/account")
  await page.getByRole("link", { name: "Sign out" }).first().click()
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await page.goto("/admin/users")
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/login/)
}
