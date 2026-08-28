import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

/** Maps an account access status onto the shared boundary state, its detail, and its title. */
export function accountAccessBoundaryStateGet(
  status: AccountAccessStatus,
  options: { readonly emptyDetail: string; readonly error?: string },
): {
  readonly detail?: string
  readonly state: "empty" | "error" | "inaccessible" | "loading" | "ready"
  readonly title?: string
} {
  if (status === "loading") return { state: "loading" }
  if (status === "empty") return { detail: options.emptyDetail, state: "empty" }
  if (status === "permission-denied")
    return { detail: messageTranslate("account.access.permission"), state: "inaccessible" }
  if (status === "expired") return { detail: options.error, state: "inaccessible" }
  if (status === "error") return { detail: options.error, state: "error" }
  return { state: "ready" }
}
