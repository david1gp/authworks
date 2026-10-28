import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Assigns the first project role to the member through the assign-roles dialog: the assigned
 * role appears as a chip afterwards and persists across reload.
 */
export async function adminOrgOwnerProjectRoleAssign(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto(`/admin/users/${encodeURIComponent(setup.memberUserId)}`)
  await page.waitForURL(/\/admin\/users\/.+/, { timeout: 30_000 })
  await page.getByRole("link", { name: "Roles and access" }).click()
  await page.getByRole("button", { name: "Assign project roles" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()

  const projectOption = page.getByRole("listbox", { name: "Project" }).getByRole("option", {
    name: new RegExp(setup.projectName),
  })
  await expect(projectOption).toBeVisible()
  await projectOption.click()

  const roleCheckbox = page.getByRole("checkbox", { name: new RegExp(setup.roleKeyA) })
  await expect(roleCheckbox).toBeVisible()
  if (!(await roleCheckbox.isChecked())) await roleCheckbox.check()
  await page.getByRole("button", { name: "Save assignments" }).click()
  await expect(page.getByText("The project assignments were saved.")).toBeVisible()
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 })

  await expect(page.getByText(setup.projectName).first()).toBeVisible()
  await page.reload()
  await page.getByRole("link", { name: "Roles and access" }).click()
  await expect(page.getByText(setup.projectName).first()).toBeVisible()
}
