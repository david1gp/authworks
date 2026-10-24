import { mdiArrowRight } from "@adaptive-ds/mdi/mdiArrowRight.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { mdiLinkOff } from "@adaptive-ds/mdi/mdiLinkOff.js"
import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { mdiLogin } from "@adaptive-ds/mdi/mdiLogin.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { accountIdentitiesSectionStateCreate } from "./accountIdentitiesSectionStateCreate.js"
import { accountIdentityProviderIconGet } from "./accountIdentityProviderIconGet.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountIdentitiesSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountIdentitiesSectionStateCreate(() => props.state)
  const stepUpFactor = () => {
    const challenge = props.state.identityStepUpChallenge()?.challenge
    return challenge?.factor ?? challenge?.availableFactors?.[0] ?? "totp"
  }
  const stepUpOpen = () =>
    props.state.identityStepUpChallenge() !== undefined ||
    props.state.identityStepUpPending() ||
    props.state.identityStepUpError() !== undefined
  const stepUpSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(props.state.identityStepUpCode())) return
    void props.state.identityStepUpComplete({ code: props.state.identityStepUpCode(), factor: stepUpFactor() })
  }
  const signInAgain = () => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = `/login?return_to=${encodeURIComponent(returnTo)}`
  }
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiLinkVariant}
      status={state.summaryStatus()}
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
                  onOpenChange={(open) => state.dialogOpenChange(identity.id, open)}
                  open={state.dialogOpen(identity.id)}
                  title={state.identityTitle(identity)}
                  trigger={
                    <AuthenticatedButton
                      variant="ghost"
                      class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span class="flex min-w-0 items-center gap-2">
                        <Icon
                          aria-hidden="true"
                          class="size-4 shrink-0 text-accent"
                          path={accountIdentityProviderIconGet(identity.providerType)}
                        />
                        <span class="grid min-w-0 gap-0.5">
                          <span class="truncate text-sm font-medium capitalize">{state.identityLabel(identity)}</span>
                          <span class="truncate text-xs text-muted-foreground">{state.identityValue(identity)}</span>
                        </span>
                      </span>
                    </AuthenticatedButton>
                  }
                >
                  <div class="grid gap-3">
                    <p class="break-words text-sm text-muted-foreground">{state.identityValue(identity)}</p>
                    <Show when={props.state.error()}>
                      {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                    </Show>
                    <div>
                      <AuthenticatedButton
                        class={authenticatedDangerOutlineButtonClass}
                        disabled={props.state.pendingId() !== undefined}
                        icon={mdiLinkOff}
                        onClick={() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("account.identities.unlink")}
                      </AuthenticatedButton>
                    </div>
                  </div>
                </AuthenticatedDialog>
              </li>
            )}
          </For>
          <Show when={state.linkAvailable()}>
            <li class="min-w-0">
              <AuthenticatedDialog
                description={messageTranslate("account.identities.linkDescription")}
                onOpenChange={state.linkDialogOpenChange}
                open={state.linkDialogOpen()}
                title={messageTranslate("account.identities.linkTitle")}
                trigger={
                  <AuthenticatedButton
                    icon={mdiLinkVariant}
                    variant="ghost"
                    class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {messageTranslate("account.identities.linkTitle")}
                  </AuthenticatedButton>
                }
              >
                <div class="grid gap-3">
                  <Show when={props.state.error()}>
                    {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                  </Show>
                  <Show when={props.state.identityRecentAuthRequired()}>
                    <div>
                      <AuthenticatedButton icon={mdiLogin} onClick={signInAgain} type="button" variant="outline">
                        {messageTranslate("account.identities.signInAgain")}
                      </AuthenticatedButton>
                    </div>
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
                                <AuthenticatedButton
                                  disabled={props.state.pendingId() !== undefined}
                                  icon={accountIdentityProviderIconGet(provider.type)}
                                  onClick={() => props.state.identityLinkStart(provider.id)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {provider.displayName}
                                </AuthenticatedButton>
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
                        <AuthenticatedButton
                          disabled={props.state.pendingId() !== undefined}
                          icon={mdiCheck}
                          onClick={state.linkConfirm}
                          type="button"
                        >
                          {messageTranslate("account.identities.confirm")}
                        </AuthenticatedButton>
                        <AuthenticatedButton
                          disabled={props.state.pendingId() !== undefined}
                          icon={mdiClose}
                          onClick={state.linkCancel}
                          type="button"
                          variant="ghost"
                        >
                          {messageTranslate("common.cancel")}
                        </AuthenticatedButton>
                      </div>
                    </div>
                  </Show>
                </div>
              </AuthenticatedDialog>
            </li>
          </Show>
        </ul>
      </div>
      <AuthenticatedDialog
        description={messageTranslate("account.identities.stepUpDescription")}
        onOpenChange={(open) => {
          if (!open) props.state.identityStepUpCancel()
        }}
        open={stepUpOpen()}
        title={messageTranslate("account.confirmTitle")}
      >
        <Show
          when={props.state.identityStepUpChallenge()}
          fallback={
            <Show
              when={props.state.identityStepUpPending()}
              fallback={
                <div class="grid gap-3">
                  <Show when={props.state.identityStepUpError()}>
                    {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                  </Show>
                  <Show when={props.state.identityRecentAuthRequired()}>
                    <div>
                      <AuthenticatedButton icon={mdiLogin} onClick={signInAgain} type="button">
                        {messageTranslate("account.identities.signInAgain")}
                      </AuthenticatedButton>
                    </div>
                  </Show>
                </div>
              }
            >
              <p aria-live="polite" class="text-sm text-muted-foreground" role="status">
                {messageTranslate("login.common.working")}
              </p>
            </Show>
          }
        >
          <form class="grid gap-3" onSubmit={stepUpSubmit}>
            <div class="grid gap-1">
              <Label for="account-identity-step-up-code">{messageTranslate("account.factors.verificationCode")}</Label>
              <AuthenticatedInput
                autocomplete="one-time-code"
                class="font-mono"
                disabled={props.state.identityStepUpPending()}
                id="account-identity-step-up-code"
                inputmode="numeric"
                maxlength={6}
                onInput={props.state.identityStepUpCodeInput}
                value={props.state.identityStepUpCode()}
              />
            </div>
            <Show when={props.state.identityStepUpError()}>
              {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
            </Show>
            <div class="flex flex-wrap gap-2">
              <AuthenticatedButton
                disabled={props.state.identityStepUpPending() || !/^\d{6}$/.test(props.state.identityStepUpCode())}
                icon={mdiArrowRight}
                type="submit"
              >
                {props.state.identityStepUpPending()
                  ? messageTranslate("common.loading")
                  : messageTranslate("common.continue")}
              </AuthenticatedButton>
              <AuthenticatedButton
                icon={mdiClose}
                onClick={props.state.identityStepUpCancel}
                type="button"
                variant="ghost"
              >
                {messageTranslate("common.cancel")}
              </AuthenticatedButton>
            </div>
          </form>
        </Show>
      </AuthenticatedDialog>
    </AccountDisclosure>
  )
}
