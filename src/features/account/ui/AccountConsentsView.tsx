import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiTrashCanOutline } from "@adaptive-ds/mdi/mdiTrashCanOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function AccountConsentsView(props: {
  readonly consents: readonly OidcConsent[]
  readonly error?: string
  readonly notice?: string
  readonly onRetry: () => void
  readonly onRevoke: (clientId: string) => void
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={
            props.status === "empty"
              ? messageTranslate("account.access.consentEmpty")
              : props.status === "permission-denied"
                ? messageTranslate("account.access.permission")
                : props.error
          }
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={
            props.status === "loading"
              ? "loading"
              : props.status === "empty"
                ? "empty"
                : props.status === "permission-denied" || props.status === "expired"
                  ? "inaccessible"
                  : "error"
          }
        />
      }
    >
      <section aria-labelledby="consents-heading" class="grid max-w-4xl gap-6 sm:gap-8">
        <div>
          <div class="flex items-center gap-2">
            <Icon class="size-5 text-accent" path={mdiCheckDecagramOutline} />
            <h2 class="text-xl font-semibold tracking-tight" id="consents-heading">
              {messageTranslate("account.access.consentDescription")}
            </h2>
          </div>
        </div>
        <Show when={props.notice === "revoked"}>
          <div
            class="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            role="status"
          >
            <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
            <span>{messageTranslate("account.access.consentRevoked")}</span>
          </div>
        </Show>
        <div class="grid gap-4">
          <For each={props.consents}>
            {(consent) => (
              <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors hover:border-line-strong/60">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="flex items-start gap-3.5 min-w-0">
                    <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon class="size-5" path={mdiApplicationOutline} />
                    </div>
                    <div class="min-w-0">
                      <h3 class="break-all font-semibold text-foreground text-base">{consent.clientId}</h3>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <For each={consent.scope}>
                          {(scope) => (
                            <span class="rounded-md border border-line bg-muted/60 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                              {scope}
                            </span>
                          )}
                        </For>
                      </div>
                      <p class="mt-2 text-xs text-muted-foreground">
                        {messageTranslate("account.access.created", {
                          date: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={props.pendingId !== undefined}
                    onClick={() => props.onRevoke(consent.clientId)}
                    variant="outlineRed"
                  >
                    <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                    {messageTranslate("common.revoke")}
                  </Button>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
    </Show>
  )
}
