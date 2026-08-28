import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountRecoveryCodesSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedSection
        class="max-w-2xl"
        description={messageTranslate("account.recovery.remaining", {
          count: props.state.methods().recoveryCodes.remaining,
        })}
        title={messageTranslate("account.recovery.summary")}
      >
        <div class="px-3 py-3">
          <Button
            disabled={props.state.pendingId() === "recovery:generate"}
            onClick={props.state.recoveryCodesGenerate}
            size="sm"
          >
            {messageTranslate("account.recovery.generate")}
          </Button>
        </div>
      </AuthenticatedSection>

      <Show when={props.state.oneTimeCodes().length > 0}>
        {/* Recovery codes are shown once, so the panel is marked for the one-time-secret checks. */}
        <div data-one-time-secret="recovery-codes">
          <AuthenticatedSection
            class="max-w-2xl border-accent/35"
            description={messageTranslate("account.recovery.once")}
            title={messageTranslate("account.recovery.saveNow")}
          >
            <div class="grid gap-2.5 px-3 py-3">
              <ul class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                <For each={props.state.oneTimeCodes()}>
                  {(code) => (
                    <li class="truncate rounded-control border border-line-subtle bg-muted px-2 py-1.5 text-center font-mono text-xs font-semibold tracking-widest">
                      {code}
                    </li>
                  )}
                </For>
              </ul>
              <div>
                <Button onClick={props.state.oneTimeCodesDismiss} size="sm" variant="outline">
                  {messageTranslate("account.recovery.saved")}
                </Button>
              </div>
            </div>
          </AuthenticatedSection>
        </div>
      </Show>
    </div>
  )
}
