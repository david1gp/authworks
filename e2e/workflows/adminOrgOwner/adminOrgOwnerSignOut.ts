import { expect } from "../../harness/e2eExpect.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/** Signs the owner out via the header sign-out control and verifies the session is gone. */
export async function adminOrgOwnerSignOut(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await page.getByRole("link", { name: "Sign out" }).first().click()
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await page.goto("/admin/users")
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/login/)
}
