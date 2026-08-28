import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

/**
 * Maps an invitation acceptance status onto the shared boundary state. Expiry, replay, and denial are
 * inaccessible rather than error states because retrying the same token can never succeed.
 */
export function accountInvitationBoundaryStateGet(
  status: AccountAccessStatus,
  error?: string,
): {
  readonly detail?: string
  readonly state: "empty" | "error" | "inaccessible" | "loading" | "ready"
  readonly title?: string
} {
  if (status === "loading") return { state: "loading" }
  if (status === "expired") return { state: "inaccessible", title: messageTranslate("account.access.expired") }
  if (status === "replayed")
    return { state: "inaccessible", title: messageTranslate("account.access.invitationReplay") }
  if (status === "permission-denied")
    return { state: "inaccessible", title: messageTranslate("account.access.permission") }
  if (status === "error" || status === "empty") {
    if (error === "missing-token")
      return { detail: messageTranslate("account.access.invitationMissing"), state: "error" }
    return { detail: error, state: "error" }
  }
  return { state: "ready" }
}
