import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountConsentsViewStateCreate } from "./accountConsentsViewStateCreate.js"

export function AccountConsentsView(props: {
  readonly consents: readonly OidcConsent[]
  readonly error?: string
  readonly notice?: string
  readonly onRetry: () => void
  readonly onRevoke: (clientId: string) => void | Promise<void>
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  const state = accountConsentsViewStateCreate({
    consents: () => props.consents,
    error: () => props.error,
    onRevoke: (clientId) => props.onRevoke(clientId),
    pendingId: () => props.pendingId,
    status: () => props.status,
  })
  return (
    <AuthenticatedPageBody>
      <Show when={props.notice === "revoked"}>
        <AuthenticatedNotice message={messageTranslate("account.access.consentRevoked")} />
      </Show>

      <AccountDisclosure
        icon={mdiApplicationOutline}
        summary={messageTranslate("account.access.consentTitle")}
        value={state.summaryValue()}
        variant="card"
      >
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <p class="text-xs text-muted-foreground">{messageTranslate("account.access.consentDescription")}</p>
          <AccountStateBoundary detail={state.boundary().detail} onRetry={props.onRetry} state={state.boundary().state}>
            <Show
              when={props.consents.length > 0}
              fallback={
                <p class="px-3 py-2.5 text-sm text-muted-foreground">
                  {messageTranslate("account.access.consentEmpty")}
                </p>
              }
            >
              <ul aria-label={messageTranslate("account.access.consentTitle")} class="divide-y divide-line-subtle">
                <For each={props.consents}>
                  {(consent) => (
                    <li class="min-w-0">
                      <AuthenticatedDialog
                        class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                        description={messageTranslate("account.access.consentDescription")}
                        onOpenChange={(open) => state.dialogOpenChange(consent.clientId, open)}
                        open={state.dialogOpen(consent.clientId)}
                        title={messageTranslate("account.access.consentManage", { clientId: consent.clientId })}
                        triggerLabel={
                          <span class="grid min-w-0 gap-0.5">
                            <span class="min-w-0 break-all font-mono text-sm font-medium">{consent.clientId}</span>
                            <span class="text-xs text-muted-foreground">
                              {messageTranslate("account.access.created", {
                                date: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                              })}
                            </span>
                          </span>
                        }
                        variant="ghost"
                      >
                        <div class="grid min-w-0 gap-3">
                          <p class="text-sm text-muted-foreground">
                            {messageTranslate("account.access.created", {
                              date: localeDateFormat(consent.createdAt, { dateStyle: "medium" }),
                            })}
                          </p>
                          <p class="text-sm text-muted-foreground">
                            {messageTranslate("account.access.consentUpdated", {
                              date: localeDateFormat(consent.updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                            })}
                          </p>
                          <div>
                            <span class="sr-only">
                              {messageTranslate("account.access.scopes", { scopes: consent.scope.join(", ") })}
                            </span>
                            <AccountRoleList values={consent.scope} />
                          </div>
                          <div>
                            <ButtonIcon
                              class={authenticatedDangerOutlineButtonClass}
                              disabled={state.revokeDisabled(consent.clientId)}
                              icon={mdiCancel}
                              onClick={() => state.consentRevoke(consent.clientId)}
                              type="button"
                              variant="outline"
                            >
                              {messageTranslate("common.revoke")}
                            </ButtonIcon>
                          </div>
                        </div>
                      </AuthenticatedDialog>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </AccountStateBoundary>
        </div>
      </AccountDisclosure>
    </AuthenticatedPageBody>
  )
}
