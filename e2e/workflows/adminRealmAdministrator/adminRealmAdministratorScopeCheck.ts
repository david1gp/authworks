import { expect } from "../../harness/e2eExpect.js"
import { adminRealmAdministratorSessionEnsure } from "./adminRealmAdministratorSessionEnsure.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/**
 * Verifies the realm-administrator users page: the organization context shows the
 * organization entries without realm links, the administration context switcher
 * reveals the realm, and the scope control switches the people list to
 * "All organizations".
 */
export async function adminRealmAdministratorScopeCheck(setup: AdminRealmAdministratorSetup): Promise<void> {
  const page = setup.context.page
  await adminRealmAdministratorSessionEnsure(setup)
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()

  // Organization context shows organization entries only.
  await expect(page.getByRole("link", { name: "Administrators" })).toHaveCount(0)

  // Switch to the realm context through the administration context switcher.
  await page.locator("[data-admin-context-switcher]").click()
  await page.locator('[data-admin-context-option="realm"]').click()
  await expect(page).toHaveURL(/\/admin\/realm(?:[?#]|$)/, { timeout: 30_000 })
  await expect(page.getByRole("link", { name: "Administrators" }).first()).toBeVisible()

  // Back to an organization to exercise the all-organizations user scope.
  await page.locator("[data-admin-context-switcher]").click()
  await page.locator('[data-admin-context-option="organization"]').first().click()
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()

  const scope = page.getByLabel("Organizations")
  await expect(scope).toBeVisible()
  await scope.selectOption("all")
  await expect(page).toHaveURL(/[?&]scope=all/, { timeout: 30_000 })

  // Server-side search (`?q=`) is picked up on reload only (same `history.replaceState`
  // persistence as the organization scope), and the all-organizations list is paginated.
  // Searching the candidate username tail keeps the organization panel (which echoes the
  // full org name) out of the match; reload once the URL carries `q`, then assert.
  const candidateTail = "realm-administrator-member"
  const candidateRow = () => page.locator("table tbody tr", { hasText: candidateTail })
  const search = page.getByRole("searchbox", { name: "Search" })
  await search.fill(candidateTail)
  await expect(page).toHaveURL(/[?&]q=/, { timeout: 30_000 })
  await page.reload()
  await expect(candidateRow().first()).toBeVisible({ timeout: 30_000 })
  await expect(candidateRow().first()).toContainText(setup.organizationName)
}
