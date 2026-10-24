import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Checks the roles page: the member is counted on the Member card, the owner on the Owner
 * card, the project group lists both project roles, and the Member card links to the
 * filtered users list.
 */
export async function adminOrgOwnerRolesPageCheck(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto("/admin/roles")
  await expect(page.getByRole("heading", { name: "Roles", exact: true })).toBeVisible()

  await expect(page.getByRole("link", { name: /Organization owner · 1 member/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Organization member · 1 member/ })).toBeVisible()

  const projectGroup = page.getByRole("region", { name: setup.projectName })
  await expect(projectGroup.getByRole("cell", { name: setup.roleKeyA })).toBeVisible()
  await expect(projectGroup.getByRole("cell", { name: setup.roleKeyB })).toBeVisible()

  await page.getByRole("link", { name: /Organization member · 1 member/ }).click()
  await page.waitForURL(/\/admin\/users\?role=member/, { timeout: 30_000 })
  await expect(page.getByText(setup.memberUserName).first()).toBeVisible()
}
