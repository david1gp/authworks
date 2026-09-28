import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { mdiLinkOff } from "@adaptive-ds/mdi/mdiLinkOff.js"
import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { accountIdentitiesSectionStateCreate } from "./accountIdentitiesSectionStateCreate.js"
import { accountIdentityProviderIconGet } from "./accountIdentityProviderIconGet.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountIdentitiesSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountIdentitiesSectionStateCreate(() => props.state)
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiLinkVariant}
      status={state.summaryStatus()}
      statusIcon={state.count() > 0 ? mdiCheckCircleOutline : mdiAlertCircleOutline}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.linkedIdentities")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.identities.description")}</p>
        <ul aria-label={messageTranslate("shell.nav.linkedIdentities")} class="divide-y divide-line-subtle">
          <Show when={state.count() === 0}>
            <li class="px-2 py-2.5 text-xs text-muted-foreground">{messageTranslate("account.identities.empty")}</li>
          </Show>
          <For each={props.state.identities()}>
            {(identity) => (
              <li class="min-w-0">
                <AuthenticatedDialog
                  class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                  onOpenChange={(open) => state.dialogOpenChange(identity.id, open)}
                  open={state.dialogOpen(identity.id)}
                  title={state.identityTitle(identity)}
                  triggerLabel={
                    <span class="flex min-w-0 items-center gap-2">
                      <Icon
                        aria-hidden="true"
                        class="size-4 shrink-0 text-muted-foreground"
                        path={accountIdentityProviderIconGet(identity.providerType)}
                      />
                      <span class="grid min-w-0 gap-0.5">
                        <span class="truncate text-sm font-medium capitalize">{state.identityLabel(identity)}</span>
                        <span class="truncate text-xs text-muted-foreground">{state.identityValue(identity)}</span>
                      </span>
                    </span>
                  }
                  variant="ghost"
                >
                  <div class="grid gap-3">
                    <p class="break-words text-sm text-muted-foreground">{state.identityValue(identity)}</p>
                    <Show when={props.state.error()}>
                      {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                    </Show>
                    <div>
                      <ButtonIcon
                        class={authenticatedDangerOutlineButtonClass}
                        disabled={props.state.pendingId() !== undefined}
                        icon={mdiLinkOff}
                        onClick={() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("account.identities.unlink")}
                      </ButtonIcon>
                    </div>
                  </div>
                </AuthenticatedDialog>
              </li>
            )}
          </For>
          <Show when={state.linkAvailable()}>
            <li class="min-w-0">
              <AuthenticatedDialog
                class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                description={messageTranslate("account.identities.linkDescription")}
                onOpenChange={state.linkDialogOpenChange}
                open={state.linkDialogOpen()}
                title={messageTranslate("account.identities.linkTitle")}
                triggerIcon={mdiLinkVariant}
                triggerLabel={messageTranslate("account.identities.linkTitle")}
                variant="ghost"
              >
                <div class="grid gap-3">
                  <Show when={props.state.error()}>
                    {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                  </Show>
                  <Show
                    when={props.state.identityLinkConfirmation()}
                    fallback={
                      <Show
                        when={props.state.pendingId()?.startsWith("identity:link:")}
                        fallback={
                          <div class="grid gap-2">
                            <For each={state.availableProviders()}>
                              {(provider) => (
                                <ButtonIcon
                                  disabled={props.state.pendingId() !== undefined}
                                  icon={accountIdentityProviderIconGet(provider.type)}
                                  onClick={() => props.state.identityLinkStart(provider.id)}
                                  type="button"
                                  variant="outline"
                                >
                                  {provider.displayName}
                                </ButtonIcon>
                              )}
                            </For>
                          </div>
                        }
                      >
                        <p aria-live="polite" class="text-sm text-muted-foreground" role="status">
                          {messageTranslate("account.identities.connecting")}
                        </p>
                      </Show>
                    }
                  >
                    <div class="grid gap-3">
                      <p class="text-sm font-semibold">{messageTranslate("account.identities.confirmTitle")}</p>
                      <p class="text-xs text-muted-foreground">
                        {messageTranslate("account.identities.confirmDescription", {
                          provider: state.linkProviderLabel(),
                        })}
                      </p>
                      <div class="flex flex-wrap gap-1.5">
                        <ButtonIcon
                          disabled={props.state.pendingId() !== undefined}
                          icon={mdiCheck}
                          onClick={state.linkConfirm}
                          type="button"
                        >
                          {messageTranslate("account.identities.confirm")}
                        </ButtonIcon>
                        <ButtonIcon
                          disabled={props.state.pendingId() !== undefined}
                          icon={mdiClose}
                          onClick={state.linkCancel}
                          type="button"
                          variant="ghost"
                        >
                          {messageTranslate("common.cancel")}
                        </ButtonIcon>
                      </div>
                    </div>
                  </Show>
                </div>
              </AuthenticatedDialog>
            </li>
          </Show>
        </ul>
      </div>
    </AccountDisclosure>
  )
}
