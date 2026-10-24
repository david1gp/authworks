import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Verifies the users list: both the member and the owner are visible, the default sort is
 * last-sign-in descending (the owner, who signed in most recently through the UI, first;
 * the member signed in earlier via API during setup), and the search box filters down to
 * the member.
 */
export async function adminOrgOwnerUsersListCheck(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
  await expect(page.getByText(setup.memberUserName).first()).toBeVisible()
  await expect(page.getByText(setup.ownerUserName).first()).toBeVisible()

  const rows = page.locator("table tbody tr")
  await expect(rows.first()).toContainText(setup.ownerUserName)

  const memberRow = rows.filter({ hasText: setup.memberUserName })
  const ownerRow = rows.filter({ hasText: setup.ownerUserName })
  await expect(memberRow.first()).toContainText("Member")
  await expect(ownerRow.first()).toContainText("Owner")

  // Filter by the member row's id tail. Note the search field persists `?q=` through
  // `history.replaceState`, which the router does not react to, so the table only picks up
  // the query on (re)load: reload once the URL carries `q`, then assert the filtered rows.
  // Matching on the `-org-owner-member` tail keeps the organization panel (which echoes the
  // full org name ending in `-org`) out of the match.
  const memberTail = "-org-owner-member"
  const memberHandleRow = () => page.locator("table tbody tr", { hasText: memberTail })
  const search = page.getByRole("searchbox", { name: "Search" })
  await search.fill(memberTail)
  await expect(page).toHaveURL(/[?&]q=/, { timeout: 30_000 })
  await page.reload()
  await expect(memberHandleRow().first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator("table tbody tr", { hasText: `@${setup.ownerUserName}` })).toHaveCount(0)
  await search.fill("")
  await expect(page).toHaveURL(/\/admin\/users(?!.*[?&]q=)/, { timeout: 30_000 })
  await page.reload()
  await expect(page.getByText(setup.ownerUserName).first()).toBeVisible()
}
