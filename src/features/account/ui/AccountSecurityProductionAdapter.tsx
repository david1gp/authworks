import type { JSX } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityProductionAdapter(props: {
  readonly apiBaseUrl?: string
  readonly passwordAction?: JSX.Element
  readonly realmId: string
  readonly screen: AccountSecurityScreen
  readonly state?: ReturnType<typeof accountSecurityProductionStateCreate>
}) {
  const state =
    props.state ??
    accountSecurityProductionStateCreate({
      apiBaseUrl: props.apiBaseUrl,
      realmId: () => props.realmId,
      screen: () => props.screen,
    })
  return (
    <>
      <AccountSecurityView passwordAction={props.passwordAction} state={state} />
      <ConfirmDialog state={state.confirmation} titleKey="account.confirmTitle" />
    </>
  )
}
