import { expect } from "../../harness/e2eExpect.js"
import { adminOrgAdminLimitsSessionEnsure } from "./adminOrgAdminLimitsSessionEnsure.js"
import type { AdminOrgAdminLimitsSetup } from "./adminOrgAdminLimitsSetupCreate.js"

/**
 * Verifies the owner-only Configuration branding page as an admin: the read-only notice is
 * shown and every form control stays disabled, so non-owner admins cannot change branding.
 */
export async function adminOrgAdminLimitsBrandingReadOnlyCheck(setup: AdminOrgAdminLimitsSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgAdminLimitsSessionEnsure(setup)
  await page.goto("/admin/configuration/branding")
  await expect(page.getByRole("heading", { name: "Configuration" }).first()).toBeVisible()

  await expect(page.getByText("Only organization owners can change these settings.")).toBeVisible()
  await expect(page.locator("#configuration-branding-light-primaryColor")).toBeVisible()
  await expect(page.locator("#configuration-branding-light-primaryColor")).toBeDisabled()
  await expect(page.locator("#configuration-branding-dark-primaryColor")).toBeDisabled()
}
