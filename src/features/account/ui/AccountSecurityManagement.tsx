import type { JSX } from "solid-js"
import { AccountFactorsSection } from "./AccountFactorsSection.js"
import { AccountIdentitiesSection } from "./AccountIdentitiesSection.js"
import { AccountPasswordSection } from "./AccountPasswordSection.js"
import { AccountPasskeysSection } from "./AccountPasskeysSection.js"
import { AccountRecoveryCodesSection } from "./AccountRecoveryCodesSection.js"
import { accountSecuritySectionIds } from "./accountSecuritySectionIds.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityManagement(props: {
  readonly passwordAction?: JSX.Element
  readonly state: AccountSecurityViewState
}) {
  return (
    <div
      class="grid min-w-0 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0"
      data-account-security-grid
    >
      <div class="min-w-0 scroll-mt-24" id={accountSecuritySectionIds.passkeys}>
        <AccountPasskeysSection state={props.state} />
      </div>
      <div class="min-w-0 scroll-mt-24" id={accountSecuritySectionIds.factors}>
        <AccountFactorsSection state={props.state} />
      </div>
      <div class="min-w-0 scroll-mt-24" id={accountSecuritySectionIds.identities}>
        <AccountIdentitiesSection state={props.state} />
      </div>
      <div class="min-w-0 scroll-mt-24" id={accountSecuritySectionIds.password}>
        <AccountPasswordSection action={props.passwordAction} state={props.state} />
      </div>
      <div class="min-w-0 scroll-mt-24 md:col-span-2 xl:col-span-1" id={accountSecuritySectionIds.recoveryCodes}>
        <AccountRecoveryCodesSection state={props.state} />
      </div>
    </div>
  )
}
