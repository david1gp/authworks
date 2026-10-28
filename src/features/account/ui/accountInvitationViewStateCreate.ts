import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountInvitationBoundaryStateGet } from "./accountInvitationBoundaryStateGet.js"

export function accountInvitationViewStateCreate(options: {
  readonly error: () => string | undefined
  readonly organizationsHref: () => string | undefined
  readonly status: () => AccountAccessStatus
}) {
  return {
    boundary: () => accountInvitationBoundaryStateGet(options.status(), options.error()),
    continuationHref: () => options.organizationsHref() ?? "/account#access",
    continuationVisible: () => options.status() !== "loading" && options.status() !== "ready",
  }
}
