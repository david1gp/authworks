import { expect } from "../../harness/e2eExpect.js"
import { adminRealmAdministratorSessionEnsure } from "./adminRealmAdministratorSessionEnsure.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/**
 * Grants realm administration to the setup candidate through the add dialog, verifies the
 * granted notice and the list entry, then revokes it through the remove confirmation and
 * verifies the removed notice and the gone entry. The service user itself is never removed.
 * Resume-safe: when the grant already landed before a crash, the dialog shows the candidate
 * as already-admin and the step continues with the row assertions.
 */
export async function adminRealmAdministratorGrantRevoke(setup: AdminRealmAdministratorSetup): Promise<void> {
  const page = setup.context.page
  await adminRealmAdministratorSessionEnsure(setup)
  await page.goto("/admin/realm/administrators")
  await expect(page.getByRole("heading", { name: "Realm administrators" }).first()).toBeVisible()

  await expect(page.getByText(`@${setup.context.serviceUsername}`).first()).toBeVisible()

  await page.getByRole("button", { name: "Add administrator" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()

  const search = page.getByLabel("Search administrators")
  await search.fill(setup.candidateUserName)
  const candidate = page.getByRole("button", { name: new RegExp(setup.candidateUserName) })
  await expect(candidate.first()).toBeVisible({ timeout: 30_000 })
  // On resume the candidate may already be granted: the button is then disabled with an
  // "Already an administrator" badge, and the step continues with the granted assertions.
  if (await candidate.first().isEnabled()) {
    await candidate.first().click()
    await expect(page.getByText(`${setup.candidateUserName} is now a realm administrator.`)).toBeVisible()
    // The grant keeps the add dialog open (the candidate flips to "Already an
    // administrator"); close it explicitly before touching the table rows.
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 })
  } else {
    await expect(candidate.first()).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 })
  }

  const addedRow = page.locator("table tbody tr", { hasText: `@${setup.candidateUserName}` })
  await expect(addedRow.first()).toBeVisible()

  const removeButton = addedRow.first().getByRole("button", { name: "Remove" })
  await removeButton.click()
  await page.getByRole("button", { name: "Remove administrator", exact: true }).click()
  await expect(page.getByText(`${setup.candidateUserName} is no longer a realm administrator.`)).toBeVisible()
  await expect(page.locator("table tbody tr", { hasText: `@${setup.candidateUserName}` })).toHaveCount(0)
}
