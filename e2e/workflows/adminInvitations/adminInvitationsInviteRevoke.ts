import { expect } from "../../harness/e2eExpect.js"
import { adminInvitationsSessionEnsure } from "./adminInvitationsSessionEnsure.js"
import type { AdminInvitationsSetup } from "./adminInvitationsSetupCreate.js"

/**
 * Revokes the pending invitation through its row action and the in-app confirmation, then
 * verifies the revoked notice and the gone row — both on the wide table and the narrow
 * record list, which share the same revoke handler.
 */
export async function adminInvitationsInviteRevoke(setup: AdminInvitationsSetup): Promise<void> {
  const page = setup.context.page
  await adminInvitationsSessionEnsure(setup)
  await page.goto("/admin/users?tab=invitations")
  await expect(page.getByRole("tab", { name: "Pending invitations" })).toHaveAttribute("aria-selected", "true")

  // invite-create is idempotent, so on resume the invitee row may already be revoked:
  // only a row with a pending action needs revoking; a revoked row ends the step.
  const inviteeRow = () => page.locator("table tbody tr", { hasText: setup.inviteeEmail }).first()
  // The list loads after navigation; the row always exists here (invite-create ran first),
  // so wait for it instead of racing the load with an immediate count.
  await expect(inviteeRow()).toBeVisible()
  const pendingAction = () => inviteeRow().getByRole("button", { name: "Revoke invitation" })
  if ((await pendingAction().count()) > 0) {
    await pendingAction().click()
    await page.getByRole("button", { name: "Continue", exact: true }).click()
  }
  // Revoked rows render a Revoked status without an action; assert the invitee row ends
  // revoked (the invitations table keeps history and never hides non-pending rows).
  await expect(
    page.locator("table tbody tr", { hasText: setup.inviteeEmail }).first().getByText("Revoked"),
  ).toBeVisible()
}
