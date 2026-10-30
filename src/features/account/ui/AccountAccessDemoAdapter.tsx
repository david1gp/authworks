import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { AccountConsentsView } from "./AccountConsentsView.js"
import { AccountInvitationsView } from "./AccountInvitationsView.js"
import { AccountInvitationView } from "./AccountInvitationView.js"
import { AccountOrganizationAccessDemoAdapter } from "./AccountOrganizationAccessDemoAdapter.js"
import { accountAccessDemoStateCreate } from "./accountAccessDemoStateCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function AccountAccessDemoAdapter(props: {
  readonly screen: AccountAccessScreen
  readonly showFixtureHeader?: boolean
}) {
  const state = accountAccessDemoStateCreate(() => props.screen)
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
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
            organizationsHref="/demo/account#access"
            status={state.status()}
          />
        </Match>
        <Match when={props.screen === "invitation"}>
          <AccountInvitationView
            organizationsHref="/demo/account#access"
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
      <ConfirmDialog state={state.confirmation} titleKey="account.confirmTitle" />
    </div>
  )
}
