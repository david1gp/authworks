import { expect } from "../../harness/e2eExpect.js"
import { adminInvitationsSessionEnsure } from "./adminInvitationsSessionEnsure.js"
import type { AdminInvitationsSetup } from "./adminInvitationsSetupCreate.js"

/**
 * Invites the run-scoped invitee through the invite dialog with the member role (checked by
 * default; the owner checkbox is disabled for non-realm-admins): the dialog stays open and
 * shows the one-time link plus its shown-once hint, then dismissing the token resets the
 * dialog back to the blank form, which is closed. Resume-safe: a leftover pending invitation
 * from an interrupted run is revoked first so the create lands exactly one pending row.
 */
export async function adminInvitationsInviteCreate(setup: AdminInvitationsSetup): Promise<void> {
  const page = setup.context.page
  await adminInvitationsSessionEnsure(setup)
  await page.goto("/admin/users?tab=invitations")
  await expect(page.getByRole("tab", { name: "Pending invitations" })).toHaveAttribute("aria-selected", "true")

  const pendingRow = page.locator("table tbody tr", { hasText: setup.inviteeEmail })
  if ((await pendingRow.count()) > 0) {
    await pendingRow.first().getByRole("button", { name: "Revoke invitation" }).click()
    await page.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(page.getByText("The invitation was revoked.")).toBeVisible()
  }

  await page.getByRole("button", { name: "Invite user" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByLabel("Email address").fill(setup.inviteeEmail)
  await expect(dialog.getByRole("checkbox", { name: "Member" })).toBeChecked()
  await dialog.getByRole("button", { name: "Send invitation" }).click()

  await expect(
    dialog.getByText("This invitation link is shown once. Share it with the person you invited."),
  ).toBeVisible()
  await expect(dialog.locator("code").first()).not.toBeEmpty()
  await expect(page).toHaveURL(/[?&]dialog=invite/)

  await dialog.getByRole("button", { name: "I saved this link" }).click()
  await expect(dialog.getByLabel("Email address")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 })

  await expect(page.locator("table tbody tr", { hasText: setup.inviteeEmail }).first()).toBeVisible()
  await expect(
    page.locator("table tbody tr", { hasText: setup.inviteeEmail }).first().getByText("Pending"),
  ).toBeVisible()
}
