import { useLocation } from "@solidjs/router"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoScenarioPlaceholderStateCreate } from "../../demo/ui/demoScenarioPlaceholderStateCreate.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AccountDemoFixtureHeader } from "./AccountDemoFixtureHeader.js"
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
  const fixture = demoScenarioPlaceholderStateCreate(() => demoAccountScenarioGroups)
  const location = useLocation()
  const state = props.state ?? accountSecurityDemoStateCreate(() => props.screen)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      {props.showFixtureHeader === false ? null : (
        <AccountDemoFixtureHeader
          description={scenario()?.description ?? ""}
          stateOptions={fixture.stateOptions()}
          title={scenario()?.title ?? ""}
        />
      )}
      <AccountSecurityView passwordAction={props.passwordAction} state={state} />
      <ConfirmDialog state={state.confirmation} titleKey="account.confirmTitle" />
    </div>
  )
}
