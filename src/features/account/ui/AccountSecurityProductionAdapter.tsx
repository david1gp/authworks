import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityProductionAdapter(props: {
  readonly realmId: string
  readonly screen: AccountSecurityScreen
}) {
  const state = accountSecurityProductionStateCreate({ realmId: () => props.realmId, screen: () => props.screen })
  return <AccountSecurityView state={state} />
}
