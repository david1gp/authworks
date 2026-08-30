import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function accountOrganizationAccessViewStateCreate(inputs: {
  readonly effectiveAccessError: () => string | undefined
  readonly effectiveAccessStatus: () => AccountAccessStatus
  readonly organizationError: () => string | undefined
  readonly organizationStatus: () => AccountAccessStatus
}) {
  const effectiveAccessBoundary = () =>
    accountAccessBoundaryStateGet(inputs.effectiveAccessStatus(), {
      emptyDetail: messageTranslate("account.access.effectiveEmpty"),
      error: inputs.effectiveAccessError(),
    })
  const organizationBoundary = () =>
    accountAccessBoundaryStateGet(inputs.organizationStatus(), {
      emptyDetail: messageTranslate("account.access.organizationEmpty"),
      error: inputs.organizationError(),
    })
  return {
    effectiveAccessBoundary,
    organizationBoundary,
  }
}
