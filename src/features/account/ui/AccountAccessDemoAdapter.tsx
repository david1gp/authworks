import { useLocation } from "@solidjs/router"
import { Match, Switch } from "solid-js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { AccountConsentsView } from "./AccountConsentsView.js"
import { AccountDemoFixtureHeader } from "./AccountDemoFixtureHeader.js"
import { AccountInvitationsView } from "./AccountInvitationsView.js"
import { AccountInvitationView } from "./AccountInvitationView.js"
import { AccountOrganizationAccessDemoAdapter } from "./AccountOrganizationAccessDemoAdapter.js"
import { accountAccessDemoStateCreate } from "./accountAccessDemoStateCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function AccountAccessDemoAdapter(props: { readonly screen: AccountAccessScreen }) {
  const location = useLocation()
  const state = accountAccessDemoStateCreate(() => props.screen)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AccountDemoFixtureHeader
        description={scenario()?.description ?? ""}
        stateOptions={state.stateOptions()}
        title={scenario()?.title ?? ""}
      />
      <Switch>
        <Match when={props.screen === "organizations" || props.screen === "effective-access"}>
          <AccountOrganizationAccessDemoAdapter organizationState={state} />
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
            invitationHref="/demo/invitations/accept"
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
