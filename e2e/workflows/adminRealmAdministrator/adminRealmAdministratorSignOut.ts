import { expect } from "../../harness/e2eExpect.js"
import { adminRealmAdministratorSessionEnsure } from "./adminRealmAdministratorSessionEnsure.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/** Signs the service user out via the header sign-out control and verifies the session is gone. */
export async function adminRealmAdministratorSignOut(setup: AdminRealmAdministratorSetup): Promise<void> {
  const page = setup.context.page
  // Orchestrator resume reruns the spec with a fresh browser profile while skipping
  // completed steps, so re-authenticate when the earlier session is gone.
  await adminRealmAdministratorSessionEnsure(setup)
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
