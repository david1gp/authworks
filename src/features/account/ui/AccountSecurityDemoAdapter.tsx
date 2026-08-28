import { useLocation } from "@solidjs/router"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoScenarioPlaceholderStateCreate } from "../../demo/ui/demoScenarioPlaceholderStateCreate.js"
import { AccountDemoFixtureHeader } from "./AccountDemoFixtureHeader.js"
import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityDemoAdapter(props: { readonly screen: AccountSecurityScreen }) {
  const fixture = demoScenarioPlaceholderStateCreate(() => demoAccountScenarioGroups)
  const location = useLocation()
  const state = accountSecurityDemoStateCreate(() => props.screen)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AccountDemoFixtureHeader
        description={scenario()?.description ?? ""}
        stateOptions={fixture.stateOptions()}
        title={scenario()?.title ?? ""}
      />
      <AccountSecurityView state={state} />
    </div>
  )
}
