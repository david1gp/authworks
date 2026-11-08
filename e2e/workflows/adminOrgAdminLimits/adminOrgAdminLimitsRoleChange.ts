import { expect } from "../../harness/e2eExpect.js"
import { adminOrgAdminLimitsSessionEnsure } from "./adminOrgAdminLimitsSessionEnsure.js"
import type { AdminOrgAdminLimitsSetup } from "./adminOrgAdminLimitsSetupCreate.js"

/**
 * Verifies the admin cannot grant ownership: on the owner's profile the Owner card is
 * disabled, and on the member's profile the Owner card is disabled too — admins manage
 * non-owners only. Then cycles the member between admin, guest, and member roles and
 * verifies each change persists across reload.
 */
export async function adminOrgAdminLimitsRoleChange(setup: AdminOrgAdminLimitsSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgAdminLimitsSessionEnsure(setup)

  await page.goto(`/admin/users/${encodeURIComponent(setup.ownerUserId)}`)
  await page.waitForURL(/\/orgs\/[^/]+\/users\/.+/, { timeout: 30_000 })
  await expect(page.getByText(`@${setup.ownerUserName}`).first()).toBeVisible()
  await page.getByRole("link", { name: "Roles and access" }).click()

  const ownerOwnerCard = page.getByRole("radio", { name: "Owner" })
  await expect(ownerOwnerCard).toBeVisible()
  await expect(ownerOwnerCard).toBeDisabled()
  await expect(ownerOwnerCard).toBeChecked()

  await page.goto(`/admin/users/${encodeURIComponent(setup.memberUserId)}`)
  await page.waitForURL(/\/orgs\/[^/]+\/users\/.+/, { timeout: 30_000 })
  await expect(page.getByText(`@${setup.memberUserName}`).first()).toBeVisible()
  await page.getByRole("link", { name: "Roles and access" }).click()

  const memberOwnerCard = page.getByRole("radio", { name: "Owner" })
  await expect(memberOwnerCard).toBeVisible()
  await expect(memberOwnerCard).toBeDisabled()

  const adminCard = page.getByRole("radio", { name: "Admin" })
  await expect(adminCard).toBeVisible()
  await adminCard.click()
  await expect(page.getByText("The organization role was updated.")).toBeVisible()
  await expect(adminCard).toBeChecked()

  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByRole("radio", { name: "Admin" })).toBeChecked()

  const guestCard = page.getByRole("radio", { name: "Guest" })
  await guestCard.click()
  await expect(page.getByText("The organization role was updated.")).toBeVisible()
  await expect(guestCard).toBeChecked()

  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByRole("radio", { name: "Guest" })).toBeChecked()

  const memberCard = page.getByRole("radio", { name: "Member" })
  await memberCard.click()
  await expect(page.getByText("The organization role was updated.")).toBeVisible()
  await expect(memberCard).toBeChecked()

  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByRole("radio", { name: "Member" })).toBeChecked()
}
