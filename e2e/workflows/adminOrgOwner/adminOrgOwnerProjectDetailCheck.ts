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

  const navigation = page.getByRole("navigation", { name: "Project detail", exact: true })
  await expect(navigation.getByRole("link", { name: "Overview" })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Roles" })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Applications" })).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Access" })).toBeVisible()

  await navigation.getByRole("link", { name: "Roles" }).click()
  await expect(page.getByText(setup.roleKeyA).first()).toBeVisible()
  await expect(page.getByText(setup.roleKeyB).first()).toBeVisible()

  await navigation.getByRole("link", { name: "Applications" }).click()
  await expect(navigation.getByRole("link", { name: "Applications" })).toHaveAttribute("aria-current", "page")

  await navigation.getByRole("link", { name: "Access" }).click()
  await expect(navigation.getByRole("link", { name: "Access" })).toHaveAttribute("aria-current", "page")
}
