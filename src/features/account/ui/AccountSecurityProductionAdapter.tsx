import type { JSX } from "solid-js"
import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityProductionAdapter(props: {
  readonly apiBaseUrl?: string
  readonly passwordAction?: JSX.Element
  readonly realmId: string
  readonly screen: AccountSecurityScreen
}) {
  const state = accountSecurityProductionStateCreate({
    apiBaseUrl: props.apiBaseUrl,
    realmId: () => props.realmId,
    screen: () => props.screen,
  })
  return <AccountSecurityView passwordAction={props.passwordAction} state={state} />
}
