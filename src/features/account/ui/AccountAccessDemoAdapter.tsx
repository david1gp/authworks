import { useLocation } from "@solidjs/router"
import { Match, Switch } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { AccountConsentsView } from "./AccountConsentsView.js"
import { AccountEffectiveAccessView } from "./AccountEffectiveAccessView.js"
import { AccountInvitationsView } from "./AccountInvitationsView.js"
import { AccountInvitationView } from "./AccountInvitationView.js"
import { AccountOrganizationsView } from "./AccountOrganizationsView.js"
import { accountAccessDemoStateCreate } from "./accountAccessDemoStateCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function AccountAccessDemoAdapter(props: { readonly screen: AccountAccessScreen }) {
  const location = useLocation()
  const state = accountAccessDemoStateCreate(() => props.screen)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  return (
    <div class="mx-auto max-w-5xl">
      <header class="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {messageTranslate("demo.fixture.preview")}
        </span>
        <h1 class="mt-5 text-3xl font-semibold tracking-tight">{ttc(scenario()?.title ?? "Access")}</h1>
        <p class="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          {ttc(scenario()?.description ?? "Account access")}
        </p>
        <div class="mt-6">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {messageTranslate("demo.fixture.state")}
          </p>
          <DemoFixtureStateSelector options={state.stateOptions()} />
        </div>
      </header>
      <Switch>
        <Match when={props.screen === "organizations"}>
          <AccountOrganizationsView
            activeOrganizationId={state.activeOrganizationId()}
            error={state.error()}
            notice={state.notice()}
            onRetry={state.reload}
            onSwitch={state.organizationSwitch}
            organizations={state.organizations()}
            pendingId={state.pendingId()}
            status={state.status()}
          />
        </Match>
        <Match when={props.screen === "effective-access"}>
          <AccountEffectiveAccessView
            error={state.error()}
            groups={state.effectiveAccessGroups()}
            nextPageToken={state.effectiveAccessNextPageToken()}
            onLoadMore={state.effectiveAccessLoadMore}
            onRetry={state.reload}
            pendingId={state.pendingId()}
            status={state.status()}
          />
        </Match>
        <Match when={props.screen === "consents"}>
          <AccountConsentsView
            consents={state.consents()}
            error={state.error()}
            notice={state.notice()}
            onRetry={state.reload}
            onRevoke={state.consentRevoke}
            pendingId={state.pendingId()}
            status={state.status()}
          />
        </Match>
        <Match when={props.screen === "invitations"}>
          <AccountInvitationsView
            error={state.error()}
            invitations={state.invitations()}
            onRetry={state.reload}
            organizationsHref="/demo/account/organizations"
            status={state.status()}
          />
        </Match>
        <Match when={props.screen === "invitation"}>
          <AccountInvitationView
            error={state.error()}
            invitation={state.invitation()}
            onAccept={state.invitationAccept}
            onDecline={state.invitationDecline}
            onRetry={state.reload}
            pendingId={state.pendingId()}
            status={state.status()}
          />
        </Match>
      </Switch>
    </div>
  )
}
