import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Checks the project detail page: all four tabs render, the Roles tab lists the two setup
 * roles, and the Applications and Access tabs render their content.
 */
export async function adminOrgOwnerProjectDetailCheck(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto("/admin/projects")
  const projectUrl = `/admin/projects/${setup.projectId}`
  await page.goto(projectUrl)
  await page.waitForURL(/\/admin\/projects\/.+/, { timeout: 30_000 })

  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Roles" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Applications" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Access" })).toBeVisible()

  await page.getByRole("tab", { name: "Roles" }).click()
  await expect(page.getByText(setup.roleKeyA).first()).toBeVisible()
  await expect(page.getByText(setup.roleKeyB).first()).toBeVisible()

  await page.getByRole("tab", { name: "Applications" }).click()
  await expect(page.getByRole("tab", { name: "Applications" })).toHaveAttribute("aria-selected", "true")

  await page.getByRole("tab", { name: "Access" }).click()
  await expect(page.getByRole("tab", { name: "Access" })).toHaveAttribute("aria-selected", "true")
}
