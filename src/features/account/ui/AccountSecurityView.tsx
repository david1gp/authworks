import type { JSX } from "solid-js"
import { Match, Show, Switch } from "solid-js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AccountFactorsSection } from "./AccountFactorsSection.js"
import { AccountIdentitiesSection } from "./AccountIdentitiesSection.js"
import { AccountPasskeysSection } from "./AccountPasskeysSection.js"
import { AccountRecoveryCodesSection } from "./AccountRecoveryCodesSection.js"
import { AccountRefreshTokensSection } from "./AccountRefreshTokensSection.js"
import { AccountSecurityHistorySection } from "./AccountSecurityHistorySection.js"
import { AccountSecurityManagement } from "./AccountSecurityManagement.js"
import { AccountSessionsSection } from "./AccountSessionsSection.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityView(props: {
  readonly passwordAction?: JSX.Element
  readonly state: AccountSecurityViewState
}) {
  const boundaryState = () => {
    if (props.state.status() === "loading") return "loading" as const
    if (props.state.status() === "error") return "error" as const
    return "ready" as const
  }
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Show when={props.state.error()}>{(error) => <AuthenticatedNotice message={error()} tone="danger" />}</Show>

      <AccountStateBoundary onRetry={props.state.reload} state={boundaryState()}>
        <Switch>
          <Match when={props.state.screen() === "overview"}>
            <AccountSecurityManagement passwordAction={props.passwordAction} state={props.state} />
          </Match>
          <Match when={props.state.screen() === "sessions"}>
            <AccountSessionsSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "passkeys"}>
            <AccountPasskeysSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "factors"}>
            <AccountFactorsSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "recovery-codes"}>
            <AccountRecoveryCodesSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "identities"}>
            <AccountIdentitiesSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "refresh-tokens"}>
            <AccountRefreshTokensSection state={props.state} />
          </Match>
          <Match when={props.state.screen() === "security-history"}>
            <AccountSecurityHistorySection state={props.state} />
          </Match>
        </Switch>
      </AccountStateBoundary>
    </div>
  )
}
