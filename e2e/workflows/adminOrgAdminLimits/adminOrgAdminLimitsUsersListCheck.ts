import { expect } from "../../harness/e2eExpect.js"
import { adminOrgAdminLimitsSessionEnsure } from "./adminOrgAdminLimitsSessionEnsure.js"
import type { AdminOrgAdminLimitsSetup } from "./adminOrgAdminLimitsSetupCreate.js"

/**
 * Verifies the admin-scoped users landing: the admin signs in to `/admin/users`, sees the
 * organization people, and the collapsed Realm nav group is absent for non-realm-admins.
 * Realm routes are server-guarded, so `/admin/realm` shows the insufficient-permission
 * panel rather than the realm settings.
 */
export async function adminOrgAdminLimitsUsersListCheck(setup: AdminOrgAdminLimitsSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgAdminLimitsSessionEnsure(setup)
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
  await expect(page.getByText(setup.memberUserName).first()).toBeVisible()
  await expect(page.getByText(setup.adminUserName).first()).toBeVisible()
  await expect(page.getByText(setup.ownerUserName).first()).toBeVisible()

  await expect(page.getByRole("button", { name: "Realm" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Realm administrators" })).toHaveCount(0)

  await page.goto("/admin/realm")
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible()

  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible()
  await expect(page.getByText("You do not have access to this destination in the current context.")).toBeVisible()
}
