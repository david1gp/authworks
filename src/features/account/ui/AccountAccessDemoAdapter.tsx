import { Match, Switch } from "solid-js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { AccountConsentsView } from "./AccountConsentsView.js"
import { AccountInvitationsView } from "./AccountInvitationsView.js"
import { AccountInvitationView } from "./AccountInvitationView.js"
import { AccountOrganizationsView } from "./AccountOrganizationsView.js"
import { accountAccessDemoStateCreate } from "./accountAccessDemoStateCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function AccountAccessDemoAdapter(props: { readonly screen: AccountAccessScreen }) {
  const state = accountAccessDemoStateCreate(() => props.screen)
  return (
    <div class="mx-auto grid max-w-5xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
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
