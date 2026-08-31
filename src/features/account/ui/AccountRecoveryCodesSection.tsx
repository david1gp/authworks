import type { JSX } from "solid-js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountRecoveryAccessStateCreate } from "./accountRecoveryAccessStateCreate.js"
import { AccountSecurityStatus } from "./AccountSecurityStatus.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountRecoveryCodesSection(props: {
  readonly passwordAction?: JSX.Element
  readonly state: AccountSecurityViewState
}) {
  const state = accountRecoveryAccessStateCreate({
    methods: props.state.methods,
    user: props.state.user,
  })
  return (
    <AuthenticatedSection class="h-full" title={messageTranslate("account.recovery.summary")}>
      <div class="divide-y divide-line-subtle">
        <For each={state.statuses()}>
          {(status, index) => (
            <AccountSecurityStatus
              action={
                index() === 0 ? (
                  props.passwordAction
                ) : index() === 3 ? (
                  <Button
                    disabled={props.state.pendingId() === "recovery:generate"}
                    onClick={props.state.recoveryCodesGenerate}
                    size="sm"
                  >
                    {messageTranslate("account.recovery.generate")}
                  </Button>
                ) : undefined
              }
              configured={status.configured}
              detail={status.detail}
              label={status.label}
            />
          )}
        </For>
      </div>
      <Show when={props.state.oneTimeCodes().length > 0}>
        <div class="border-t border-accent/35 bg-accent/5 px-3 py-3" data-one-time-secret="recovery-codes">
          <p class="text-sm font-semibold">{messageTranslate("account.recovery.saveNow")}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{messageTranslate("account.recovery.once")}</p>
          <ul class="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            <For each={props.state.oneTimeCodes()}>
              {(code) => (
                <li class="truncate rounded-control border border-line-subtle bg-muted px-2 py-1.5 text-center font-mono text-xs font-semibold tracking-widest">
                  {code}
                </li>
              )}
            </For>
          </ul>
          <div class="mt-2.5">
            <Button onClick={props.state.oneTimeCodesDismiss} size="sm" variant="outline">
              {messageTranslate("account.recovery.saved")}
            </Button>
          </div>
        </div>
      </Show>
    </AuthenticatedSection>
  )
}
