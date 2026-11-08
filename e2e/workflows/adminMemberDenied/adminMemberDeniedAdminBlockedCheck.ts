import { expect } from "../../harness/e2eExpect.js"
import type { AdminMemberDeniedSetup } from "./adminMemberDeniedSetupCreate.js"

/**
 * Navigating to `/admin/users` as a plain member redirects to the slug users page, which is
 * member-open: the Users heading and link render (scoped server-side to the member's view),
 * while the admin-only Roles/Projects links stay hidden. The admin-only activity page still
 * denies members with the insufficient-permission panel.
 */
export async function adminMemberDeniedAdminBlockedCheck(setup: AdminMemberDeniedSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/account")
  await expect(page.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0)
  await page.goto("/admin/users")
  await expect(page).toHaveURL(/\/orgs\/[^/]+\/users$/)
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Users" }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Roles" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Projects" })).toHaveCount(0)
  await page.goto("/admin/activity")
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Activity", exact: true })).toHaveCount(0)
}
