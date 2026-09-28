import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function accountOrganizationAccessViewStateCreate(inputs: {
  readonly effectiveAccessError: () => string | undefined
  readonly effectiveAccessStatus: () => AccountAccessStatus
  readonly organizationError: () => string | undefined
  readonly organizationStatus: () => AccountAccessStatus
  readonly organizations: () => readonly OrganizationMe[]
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
    organizationSummary: () => {
      if (inputs.organizationStatus() === "loading") return messageTranslate("common.loading")
      if (inputs.organizationStatus() === "error") return messageTranslate("account.access.error")
      return messageTranslate(
        inputs.organizations().length === 1
          ? "account.access.organizationCountOne"
          : "account.access.organizationCount",
        { count: inputs.organizations().length },
      )
    },
  }
}
