import { mdiBackupRestore } from "@adaptive-ds/mdi/mdiBackupRestore.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { accountRecoveryCodesSectionStateCreate } from "./accountRecoveryCodesSectionStateCreate.js"
import { AccountSecurityStatus } from "./AccountSecurityStatus.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountRecoveryCodesSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountRecoveryCodesSectionStateCreate(() => props.state)
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiBackupRestore}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.recoveryCodes")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.factors.description")}</p>
        <div class="divide-y divide-line-subtle">
          <For each={state.statuses()}>
            {(status) => (
              <AccountSecurityStatus configured={status.configured} detail={status.detail} label={status.label} />
            )}
          </For>
        </div>
        <AuthenticatedDialog
          description={messageTranslate("account.recovery.remaining", { count: state.remaining() })}
          onOpenChange={state.dialogOpenChange}
          open={state.dialogOpen()}
          title={messageTranslate("shell.nav.recoveryCodes")}
          triggerIcon={mdiBackupRestore}
          triggerLabel={messageTranslate("account.recovery.generate")}
          variant="outline"
        >
          <div class="grid gap-3">
            <Show when={props.state.error()}>{(error) => <AuthenticatedNotice message={error()} tone="danger" />}</Show>
            <Show
              when={props.state.oneTimeCodes().length > 0}
              fallback={
                <ButtonIcon
                  disabled={props.state.pendingId() !== undefined}
                  icon={mdiBackupRestore}
                  onClick={props.state.recoveryCodesGenerate}
                  type="button"
                >
                  {messageTranslate("account.recovery.generate")}
                </ButtonIcon>
              }
            >
              <div class="border border-accent/35 bg-accent/5 px-3 py-3" data-one-time-secret="recovery-codes">
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
                  <ButtonIcon icon={mdiCheck} onClick={state.codesDismiss} type="button" variant="outline">
                    {messageTranslate("account.recovery.saved")}
                  </ButtonIcon>
                </div>
              </div>
            </Show>
          </div>
        </AuthenticatedDialog>
      </div>
    </AccountDisclosure>
  )
}
