import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Changes the member's organization role to admin via the role cards, verifies persistence
 * across reload, then changes it back to member and verifies again.
 */
export async function adminOrgOwnerRoleChange(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto(`/admin/users/${encodeURIComponent(setup.memberUserId)}`)
  await page.waitForURL(/\/admin\/users\/.+/, { timeout: 30_000 })
  await page.getByRole("link", { name: "Roles and access" }).click()

  const adminCard = page.getByRole("radio", { name: "Admin" })
  await expect(adminCard).toBeVisible()
  await adminCard.click()
  await expect(page.getByText("The organization role was updated.")).toBeVisible()
  await expect(adminCard).toHaveAttribute("aria-checked", "true")

  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByRole("radio", { name: "Admin" })).toHaveAttribute("aria-checked", "true")

  const memberCard = page.getByRole("radio", { name: "Member" })
  await memberCard.click()
  await expect(page.getByText("The organization role was updated.")).toBeVisible()
  await expect(memberCard).toHaveAttribute("aria-checked", "true")

  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByRole("radio", { name: "Member" })).toHaveAttribute("aria-checked", "true")
}
