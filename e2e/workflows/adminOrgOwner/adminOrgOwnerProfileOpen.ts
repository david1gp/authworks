import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Opens the member's profile. Navigates directly to the member profile URL: the users-list
 * search field persists `?q=` through `history.replaceState`, which the router does not
 * react to, so clearing the field does not reliably restore the full list. The profile title
 * is the display name (the setup seeds it with the username).
 */
export async function adminOrgOwnerProfileOpen(setup: AdminOrgOwnerSetup): Promise<string> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await page.goto(`/admin/users/${encodeURIComponent(setup.memberUserId)}`)
  await page.waitForURL(/\/admin\/users\/.+/, { timeout: 30_000 })
  await expect(page.getByText(`@${setup.memberUserName}`).first()).toBeVisible()
  return page.url()
}
