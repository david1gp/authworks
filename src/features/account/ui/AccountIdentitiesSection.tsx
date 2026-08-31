import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountIdentityProviderIconGet } from "./accountIdentityProviderIconGet.js"
import { AccountSecurityStatus } from "./AccountSecurityStatus.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountIdentitiesSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <AuthenticatedSection class="h-full" title={messageTranslate("shell.nav.linkedIdentities")}>
      <AccountSecurityStatus
        configured={props.state.identities().length > 0}
        detail={messageTranslate("account.security.identityCount", { count: props.state.identities().length })}
        label={messageTranslate(
          props.state.identities().length > 0 ? "account.status.configured" : "account.status.notConfigured",
        )}
      />
      <div class="border-t border-line-subtle px-3 py-2.5">
        <p class="mb-2 text-xs text-muted-foreground">{messageTranslate("account.identities.linkDescription")}</p>
        <div class="flex flex-wrap gap-1.5">
          <For each={props.state.identityProviders()}>
            {(provider) => (
              <Button
                disabled={props.state.identityProviderLinked(provider.id) || props.state.pendingId() !== undefined}
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
      </div>
      <Show when={props.state.identityLinkConfirmation()}>
        <div class="border-t border-accent/35 bg-accent/5 px-3 py-2.5">
          <p class="text-sm font-semibold">{messageTranslate("account.identities.confirmTitle")}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {messageTranslate("account.identities.confirmDescription", {
              provider: props.state.identityLinkProvider() ?? messageTranslate("account.identities.externalAccount"),
            })}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
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
        </div>
      </Show>
      <Show
        when={props.state.identities().length > 0}
        fallback={
          <p class="border-t border-line-subtle px-3 py-5 text-center text-sm text-muted-foreground">
            {messageTranslate("account.identities.empty")}
          </p>
        }
      >
        <ul class="divide-y divide-line-subtle border-t border-line-subtle">
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
  )
}
