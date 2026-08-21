import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
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
      <section aria-labelledby="consents-heading" class="grid gap-5">
        <div>
          <h2 class="text-xl font-semibold" id="consents-heading">
            {messageTranslate("account.access.consentDescription")}
          </h2>
        </div>
        <Show when={props.notice === "revoked"}>
          <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
            {messageTranslate("account.access.consentRevoked")}
          </p>
        </Show>
        <div class="grid gap-4">
          <For each={props.consents}>
            {(consent) => (
              <article class="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 class="break-all text-lg font-semibold">{consent.clientId}</h3>
                    <p class="mt-2 text-sm text-muted-foreground">
                      {messageTranslate("account.access.scopes", { scopes: consent.scope.join(", ") })}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {messageTranslate("account.access.created", {
                        date: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                      })}
                    </p>
                  </div>
                  <Button
                    disabled={props.pendingId !== undefined}
                    onClick={() => props.onRevoke(consent.clientId)}
                    variant="outlineRed"
                  >
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
