import { mdiLockReset } from "@adaptive-ds/mdi/mdiLockReset.js"
import type { JSX } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { accountPasswordSectionStateCreate } from "./accountPasswordSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountPasswordSection(props: {
  readonly action?: JSX.Element
  readonly state: AccountSecurityViewState
}) {
  const state = accountPasswordSectionStateCreate(() => props.state)
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiLockReset}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.password")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.password.description")}</p>
        {props.action}
      </div>
    </AccountDisclosure>
  )
}
