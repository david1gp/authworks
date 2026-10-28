import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"
import type { JSX } from "solid-js"

export function AccountSecurityDemoAdapter(props: {
  readonly passwordAction?: JSX.Element
  readonly screen: AccountSecurityScreen
  readonly showFixtureHeader?: boolean
  readonly state?: ReturnType<typeof accountSecurityDemoStateCreate>
}) {
  const state = props.state ?? accountSecurityDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AccountSecurityView passwordAction={props.passwordAction} state={state} />
      <ConfirmDialog state={state.confirmation} titleKey="account.confirmTitle" />
    </div>
  )
}
