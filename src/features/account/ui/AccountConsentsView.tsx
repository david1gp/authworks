import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
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
  const boundary = () =>
    accountAccessBoundaryStateGet(props.status, {
      emptyDetail: messageTranslate("account.access.consentEmpty"),
      error: props.error,
    })
  return (
    <AuthenticatedPageBody>
      <p class="text-sm text-muted-foreground">{messageTranslate("account.access.consentDescription")}</p>

      <Show when={props.notice === "revoked"}>
        <AuthenticatedNotice message={messageTranslate("account.access.consentRevoked")} />
      </Show>

      <AccountStateBoundary detail={boundary().detail} onRetry={props.onRetry} state={boundary().state}>
        <AuthenticatedSection label={messageTranslate("admin.oidc.consents.title")}>
          <ul class="divide-y divide-line-subtle">
            <For each={props.consents}>
              {(consent) => (
                <li class="grid min-w-0 gap-2 px-3 py-2.5">
                  <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div class="min-w-0 flex-1">
                      <h2 class="min-w-0 truncate font-mono text-sm font-medium">{consent.clientId}</h2>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {messageTranslate("account.access.created", {
                          date: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                        })}
                      </p>
                    </div>
                    <Button
                      disabled={props.pendingId !== undefined}
                      onClick={() => props.onRevoke(consent.clientId)}
                      size="sm"
                      variant="filledRed"
                    >
                      {messageTranslate("common.revoke")}
                    </Button>
                  </div>
                  {/* The dense chips carry no prose, so the granted scopes keep a spoken summary. */}
                  <div>
                    <span class="sr-only">
                      {messageTranslate("account.access.scopes", { scopes: consent.scope.join(", ") })}
                    </span>
                    <AccountRoleList values={consent.scope} />
                  </div>
                </li>
              )}
            </For>
          </ul>
        </AuthenticatedSection>
      </AccountStateBoundary>
    </AuthenticatedPageBody>
  )
}
