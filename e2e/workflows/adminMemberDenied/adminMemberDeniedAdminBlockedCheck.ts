import { expect } from "../../harness/e2eExpect.js"
import type { AdminMemberDeniedSetup } from "./adminMemberDeniedSetupCreate.js"

/**
 * Navigating to `/admin/users` as a plain member shows the insufficient-permission panel
 * ("Access unavailable") and no admin navigation is rendered (no Users/Roles/Projects links).
 */
export async function adminMemberDeniedAdminBlockedCheck(setup: AdminMemberDeniedSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/account")
  await expect(page.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0)
  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Roles" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Projects" })).toHaveCount(0)
  await page.goto("/admin/activity")
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Activity", exact: true })).toHaveCount(0)
}
