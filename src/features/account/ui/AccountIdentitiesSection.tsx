import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountSplitColumns } from "./AccountSplitColumns.js"
import { accountIdentityProviderIconGet } from "./accountIdentityProviderIconGet.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountIdentitiesSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <p class="text-sm text-muted-foreground">{messageTranslate("account.identities.description")}</p>

      {/* Linked external accounts stay on the left; linking a new provider is the right-hand card. */}
      <AccountSplitColumns
        secondary={
          <>
            <AuthenticatedSection
              description={messageTranslate("account.identities.linkDescription")}
              title={messageTranslate("account.identities.linkTitle")}
            >
              <div class="flex flex-wrap gap-1.5 px-3 py-3">
                <For each={props.state.identityProviders()}>
                  {(provider) => (
                    <Button
                      disabled={
                        props.state.identityProviderLinked(provider.id) || props.state.pendingId() !== undefined
                      }
                      onClick={() => props.state.identityLinkStart(provider.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Icon class="mr-1.5 size-4" path={accountIdentityProviderIconGet(provider.type)} />
                      {provider.displayName}
                    </Button>
                  )}
                </For>
              </div>
            </AuthenticatedSection>

            <Show when={props.state.identityLinkConfirmation()}>
              <AuthenticatedSection
                class="border-accent/35"
                description={messageTranslate("account.identities.confirmDescription", {
                  provider:
                    props.state.identityLinkProvider() ?? messageTranslate("account.identities.externalAccount"),
                })}
                title={messageTranslate("account.identities.confirmTitle")}
              >
                <div class="flex flex-wrap gap-1.5 px-3 py-3">
                  <Button
                    disabled={props.state.pendingId() === "identity:link:confirm"}
                    onClick={props.state.identityLinkConfirm}
                    size="sm"
                  >
                    {messageTranslate("account.identities.confirm")}
                  </Button>
                  <Button onClick={props.state.identityLinkCancel} size="sm" variant="ghost">
                    {messageTranslate("common.cancel")}
                  </Button>
                </div>
              </AuthenticatedSection>
            </Show>
          </>
        }
        primary={
          <AuthenticatedSection title={messageTranslate("shell.nav.linkedIdentities")}>
            <Show
              when={props.state.identities().length > 0}
              fallback={
                <ProductionStatePanel compact state="empty" title={messageTranslate("account.identities.empty")} />
              }
            >
              <ul class="divide-y divide-line-subtle">
                <For each={props.state.identities()}>
                  {(identity) => (
                    <li class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5">
                      <div class="flex min-w-0 flex-1 items-center gap-2">
                        <Icon
                          class="size-4 shrink-0 text-muted-foreground"
                          path={accountIdentityProviderIconGet(identity.providerType)}
                        />
                        <div class="min-w-0">
                          <h2 class="min-w-0 truncate text-sm font-medium capitalize">{identity.providerType}</h2>
                          <p class="min-w-0 truncate text-xs text-muted-foreground">
                            {identity.email ?? identity.username ?? identity.displayName ?? identity.externalSubject}
                          </p>
                        </div>
                      </div>
                      <Button
                        disabled={props.state.pendingId() === `identity:${identity.providerId}`}
                        onClick={() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("account.identities.unlink")}
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </AuthenticatedSection>
        }
      />
    </div>
  )
}
