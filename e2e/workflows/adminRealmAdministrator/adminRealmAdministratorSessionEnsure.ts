import { expect } from "../../harness/e2eExpect.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"
import { adminRealmAdministratorSignIn } from "./adminRealmAdministratorSignIn.js"

/**
 * Ensures the page holds an authenticated service-user session. Orchestrator resume re-runs
 * the spec with a fresh browser profile while skipping completed steps, so UI steps after
 * `sign-in` must re-authenticate when the session is gone. Leaves the page on `/admin/users`;
 * steps that need a deeper page navigate from there.
 */
export async function adminRealmAdministratorSessionEnsure(setup: AdminRealmAdministratorSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/admin/users")
  await page.waitForURL(/\/admin\/users|\/login/, { timeout: 30_000 })
  // The guard bounces to /login asynchronously after the session check resolves, so the
  // URL sampled right after navigation can still be /admin/users on a signed-out page.
  // Wait for a settled marker before branching.
  const usersHeading = page.getByRole("heading", { name: "Users" }).first()
  const loginMarker = page.getByRole("heading", { name: "Choose a method" }).or(page.getByLabel("Username or email"))
  await expect(usersHeading.or(loginMarker)).toBeVisible({ timeout: 30_000 })
  if (/\/login/.test(page.url())) {
    await adminRealmAdministratorSignIn(page, setup)
    return
  }
  await page.waitForURL(/\/admin\/users/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
}
