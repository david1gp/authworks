import { Match, Switch } from "solid-js"
import { AccountConsentsView } from "./AccountConsentsView.js"
import { AccountEffectiveAccessView } from "./AccountEffectiveAccessView.js"
import { AccountInvitationsView } from "./AccountInvitationsView.js"
import { AccountInvitationView } from "./AccountInvitationView.js"
import { AccountOrganizationsView } from "./AccountOrganizationsView.js"
import { accountAccessProductionStateCreate } from "./accountAccessProductionStateCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function AccountAccessProductionAdapter(props: { readonly screen: AccountAccessScreen }) {
  const state = accountAccessProductionStateCreate(() => props.screen)
  return (
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
          organizationsHref="/account#access"
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
  )
}
