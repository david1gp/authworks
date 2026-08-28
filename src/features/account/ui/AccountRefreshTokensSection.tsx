import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { accountRefreshTokenStatusLabelGet } from "./accountRefreshTokenStatusLabelGet.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountRefreshTokensSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <Show when={props.state.refreshTokens().some((token) => token.status === "active")}>
            <Button
              class="h-7 text-xs"
              disabled={props.state.pendingId() === "refresh-tokens:all"}
              onClick={props.state.refreshTokensRevokeAll}
              variant="filledRed"
            >
              {messageTranslate("account.refreshTokens.revokeAll")}
            </Button>
          </Show>
        }
        label={messageTranslate("shell.nav.refreshTokens")}
      >
        <p class="text-sm text-muted-foreground">{messageTranslate("account.refreshTokens.description")}</p>
      </AuthenticatedToolbar>

      <AuthenticatedSection label={messageTranslate("account.refreshTokens.title")}>
        <Show
          when={props.state.refreshTokens().length > 0}
          fallback={
            <ProductionStatePanel compact state="empty" title={messageTranslate("account.refreshTokens.empty")} />
          }
        >
          <ul class="divide-y divide-line-subtle">
            <For each={props.state.refreshTokens()}>
              {(token) => (
                <li class="grid min-w-0 gap-2 px-3 py-2.5">
                  <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span class="min-w-0 truncate text-sm font-medium">{token.clientName}</span>
                      <AuthenticatedStatus
                        label={messageTranslate(accountRefreshTokenStatusLabelGet(token.status).key)}
                        tone={accountRefreshTokenStatusLabelGet(token.status).tone}
                      />
                    </div>
                    <Show when={token.status === "active"}>
                      <Button
                        disabled={props.state.pendingId() === `refresh-token:${token.familyId}`}
                        onClick={() => props.state.refreshTokenRevoke(token.familyId)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("account.refreshTokens.revoke")}
                      </Button>
                    </Show>
                  </div>
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
                </li>
              )}
            </For>
          </ul>
        </Show>
      </AuthenticatedSection>
    </div>
  )
}
