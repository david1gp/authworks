import { expect } from "../../harness/e2eExpect.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/** Signs the service user out via the header sign-out control and verifies the session is gone. */
export async function adminRealmAdministratorSignOut(setup: AdminRealmAdministratorSetup): Promise<void> {
  const page = setup.context.page
  await page.getByRole("link", { name: "Sign out" }).first().click()
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await page.goto("/admin/users")
  await page.waitForURL(/\/login/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/login/)
}
