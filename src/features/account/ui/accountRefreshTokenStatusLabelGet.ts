import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

/** Maps a refresh-token family status onto its catalog label and status tone. */
export function accountRefreshTokenStatusLabelGet(status: string): {
  readonly key: MessageKey
  readonly tone: AuthenticatedStatusTone
} {
  if (status === "active") return { key: "account.refreshTokens.active", tone: "success" }
  if (status === "expired") return { key: "account.refreshTokens.expired", tone: "neutral" }
  return { key: "account.refreshTokens.revoked", tone: "danger" }
}
