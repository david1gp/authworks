import { A, useLocation } from "@solidjs/router"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { demoScenarioPlaceholderStateCreate } from "../../demo/ui/demoScenarioPlaceholderStateCreate.js"
import { AccountSecurityView } from "./AccountSecurityView.js"
import { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { AccountSecurityScreen } from "./accountSecurityScreenSchema.js"

export function AccountSecurityDemoAdapter(props: { readonly screen: AccountSecurityScreen }) {
  const fixture = demoScenarioPlaceholderStateCreate(() => demoAccountScenarioGroups)
  const location = useLocation()
  const state = accountSecurityDemoStateCreate(() => props.screen)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  return (
    <div class="mx-auto max-w-5xl py-4 sm:py-10">
      <A class="text-sm font-medium text-accent hover:underline" href="/demo/account">
        ← {ttc("Back to directory")}
      </A>
      <header class="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {ttc("Stateless fixture preview")}
        </span>
        <h1 class="mt-5 text-3xl font-semibold tracking-tight">{ttc(scenario()?.title ?? "Security")}</h1>
        <p class="mt-3 max-w-2xl leading-7 text-muted-foreground">
          {ttc(scenario()?.description ?? "Account security")}
        </p>
        <div class="mt-6">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{ttc("Fixture state")}</p>
          <DemoFixtureStateSelector options={fixture.stateOptions()} />
        </div>
      </header>
      <div class="mt-5">
        <AccountSecurityView state={state} />
      </div>
    </div>
  )
}
