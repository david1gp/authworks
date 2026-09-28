import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiKeyRemove } from "@adaptive-ds/mdi/mdiKeyRemove.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { accountRefreshTokenStatusLabelGet } from "./accountRefreshTokenStatusLabelGet.js"
import { accountRefreshTokensSectionStateCreate } from "./accountRefreshTokensSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountRefreshTokensSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountRefreshTokensSectionStateCreate(
    () => props.state.refreshTokens(),
    () => props.state.refreshTokensNextPageToken(),
  )
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiKeyChain}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.applications")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.refreshTokens.description")}</p>
        <Show
          when={props.state.refreshTokens().length > 0}
          fallback={
            <p class="px-2 py-2.5 text-sm text-muted-foreground">{messageTranslate("account.refreshTokens.empty")}</p>
          }
        >
          <ul aria-label={messageTranslate("account.refreshTokens.title")} class="divide-y divide-line-subtle">
            <For each={props.state.refreshTokens()}>
              {(token) => (
                <li class="min-w-0">
                  <AuthenticatedDialog
                    class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                    description={messageTranslate("account.refreshTokens.description")}
                    onOpenChange={(open) => state.dialogOpenChange(token.familyId, open)}
                    open={state.dialogOpen(token.familyId)}
                    title={messageTranslate("account.refreshTokens.manage", { application: token.clientName })}
                    triggerLabel={
                      <span class="grid min-w-0 gap-0.5">
                        <span class="flex min-w-0 flex-wrap items-center gap-2">
                          <span class="min-w-0 break-words text-sm font-medium">{token.clientName}</span>
                          <AuthenticatedStatus
                            label={messageTranslate(accountRefreshTokenStatusLabelGet(token.status).key)}
                            tone={accountRefreshTokenStatusLabelGet(token.status).tone}
                          />
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {messageTranslate("account.refreshTokens.lastUsed", {
                            date:
                              token.lastUsedAt === null
                                ? messageTranslate("account.refreshTokens.neverUsed")
                                : localeDateFormat(token.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </span>
                      </span>
                    }
                    variant="ghost"
                  >
                    <div class="grid gap-3">
                      <AccountRoleList values={token.scope} />
                      <AuthenticatedFieldList
                        columns={3}
                        fields={[
                          {
                            label: messageTranslate("admin.users.sessions.lastUsed"),
                            value:
                              token.lastUsedAt === null
                                ? messageTranslate("account.refreshTokens.neverUsed")
                                : localeDateFormat(token.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                          },
                          {
                            label: messageTranslate("admin.users.sessions.expires"),
                            value: localeDateFormat(token.expiresAt, { dateStyle: "medium", timeStyle: "short" }),
                          },
                          {
                            label: messageTranslate("account.refreshTokens.revoked"),
                            value:
                              token.revokedAt === null
                                ? ""
                                : localeDateFormat(token.revokedAt, { dateStyle: "medium", timeStyle: "short" }),
                          },
                        ]}
                      />
                      <Show when={token.status === "active"}>
                        <div>
                          <ButtonIcon
                            class={authenticatedDangerOutlineButtonClass}
                            disabled={props.state.pendingId() !== undefined || !state.dialogOpen(token.familyId)}
                            icon={mdiKeyRemove}
                            onClick={() => state.tokenRevoke(token.familyId, props.state.refreshTokenRevoke)}
                            type="button"
                            variant="outline"
                          >
                            {messageTranslate("account.refreshTokens.revoke")}
                          </ButtonIcon>
                        </div>
                      </Show>
                    </div>
                  </AuthenticatedDialog>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={props.state.refreshTokensNextPageToken()}>
          <div>
            <ButtonIcon
              disabled={props.state.pendingId() !== undefined}
              icon={mdiChevronDown}
              onClick={props.state.refreshTokensLoadMore}
              variant="outline"
            >
              {messageTranslate("account.refreshTokens.loadMore")}
            </ButtonIcon>
          </div>
        </Show>
        <Show when={state.canRevokeAll()}>
          <div>
            <AuthenticatedDialog
              description={messageTranslate("account.refreshTokens.revokeAllConfirm")}
              onOpenChange={state.allDialogOpenChange}
              open={state.allDialogOpen()}
              title={messageTranslate("account.refreshTokens.revokeAll")}
              triggerIcon={mdiKeyRemove}
              triggerLabel={messageTranslate("account.refreshTokens.revokeAll")}
              variant="outline"
            >
              <ButtonIcon
                disabled={props.state.pendingId() !== undefined || !state.allDialogOpen()}
                icon={mdiKeyRemove}
                onClick={() => state.tokensRevokeAll(props.state.refreshTokensRevokeAll)}
                type="button"
                variant="filledRed"
              >
                {messageTranslate("account.refreshTokens.revokeAll")}
              </ButtonIcon>
            </AuthenticatedDialog>
          </div>
        </Show>
      </div>
    </AccountDisclosure>
  )
}
