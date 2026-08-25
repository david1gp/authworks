import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityProductionAdapter(props: {
  readonly apiBaseUrl?: string
  readonly realmId: string
  readonly screen: AccountSecurityScreen
}) {
  const state = accountSecurityProductionStateCreate({
    apiBaseUrl: props.apiBaseUrl,
    realmId: () => props.realmId,
    screen: () => props.screen,
  })
  return <AccountSecurityView state={state} />
}
