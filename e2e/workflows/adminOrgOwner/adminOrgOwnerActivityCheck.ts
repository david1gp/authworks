import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

export async function adminOrgOwnerActivityCheck(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto("/account")
  const administration = page.getByRole("link", { name: "Administration", exact: true })
  await expect(administration).toBeVisible()
  await administration.click()
  const activity = page.getByRole("link", { name: "Activity", exact: true })
  await expect(activity).toBeVisible()
  await activity.click()
  await expect(page).toHaveURL(/\/admin\/activity(?:[?#].*)?$/)
  await expect(page.getByRole("heading", { name: /^(Activity|Recent activity)$/i }).first()).toBeVisible()
  await expect(page.getByText(`Organization · ${setup.organizationName}`, { exact: true })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Organization membership updated", exact: true }).first(),
  ).toBeVisible()
}
