import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function accountPasswordSectionStateCreate(security: Accessor<AccountSecurityViewState>) {
  const configured = () => security().methods().password.available
  return {
    summaryStatus: () => messageTranslate(configured() ? "account.status.configured" : "account.status.notConfigured"),
    summaryTone: () => (configured() ? ("success" as const) : ("neutral" as const)),
    summaryValue: () =>
      messageTranslate(
        configured() ? "account.securityOverview.passwordSet" : "account.securityOverview.passwordMissing",
      ),
  }
}
