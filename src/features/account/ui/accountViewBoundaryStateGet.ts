import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

/**
 * Maps a profile, password, or deletion status onto the shared boundary state. `success` keeps the
 * form mounted so the page can announce the saved change next to the controls that produced it.
 */
export function accountViewBoundaryStateGet(
  status: AccountViewStatus,
  errorMessage?: string,
): {
  readonly detail?: string
  readonly state: "empty" | "error" | "inaccessible" | "loading" | "ready"
  readonly title?: string
} {
  if (status === "loading") return { state: "loading" }
  if (status === "expired")
    return { detail: errorMessage, state: "inaccessible", title: messageTranslate("account.sessionExpired") }
  if (status === "error") return { detail: errorMessage, state: "error" }
  return { state: "ready" }
}
