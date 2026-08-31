import type { JSX } from "solid-js"
import { AccountFactorsSection } from "./AccountFactorsSection.js"
import { AccountIdentitiesSection } from "./AccountIdentitiesSection.js"
import { AccountPasskeysSection } from "./AccountPasskeysSection.js"
import { AccountRecoveryCodesSection } from "./AccountRecoveryCodesSection.js"
import { AccountSecurityProgress } from "./AccountSecurityProgress.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityManagement(props: {
  readonly passwordAction?: JSX.Element
  readonly state: AccountSecurityViewState
}) {
  return (
    <div class="grid min-w-0 gap-3">
      <div
        class="grid min-w-0 items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-4 [&>*]:min-w-0"
        data-account-security-grid
      >
        <AccountPasskeysSection state={props.state} />
        <AccountFactorsSection state={props.state} />
        <AccountIdentitiesSection state={props.state} />
        <AccountRecoveryCodesSection passwordAction={props.passwordAction} state={props.state} />
      </div>
      <AccountSecurityProgress state={props.state} />
    </div>
  )
}
