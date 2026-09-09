import { mdiCellphoneKey } from "@adaptive-ds/mdi/mdiCellphoneKey.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderSpin4Square } from "#ui/static/loaders/LoaderSpin4Square.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountSecurityStatus } from "./AccountSecurityStatus.js"
import { accountFactorsSectionStateCreate } from "./accountFactorsSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountFactorsSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountFactorsSectionStateCreate(() => props.state)
  return (
    <AuthenticatedSection
      actions={
        <AuthenticatedDialog
          class="h-8 text-xs"
          description={messageTranslate("account.factors.totpSecretOnce")}
          disabled={props.state.pendingId()?.startsWith("totp:")}
          onOpenChange={props.state.totpDialogOpenSet}
          open={props.state.totpDialogOpen()}
          title={messageTranslate("account.factors.finishTotp")}
          triggerLabel={messageTranslate("account.factors.addTotp")}
          variant="filledBlue"
        >
          <Show when={!state.startPending()} fallback={<AccountFactorsSectionLoading />}>
            <Show when={props.state.totpSetup()}>
              {(setup) => (
                <div class="grid min-w-0 gap-2.5">
                  <code class="block overflow-x-auto rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs tracking-wider">
                    {setup().secret}
                  </code>
                  <p class="break-all font-mono text-xs text-muted-foreground">{setup().otpauthUri}</p>
                  <div class="grid min-w-0 gap-1">
                    <Label for="account-totp-code">{messageTranslate("account.factors.verificationCode")}</Label>
                    <Input
                      autocomplete="one-time-code"
                      class="font-mono"
                      disabled={state.confirmPending()}
                      id="account-totp-code"
                      inputmode="numeric"
                      maxlength={6}
                      onInput={props.state.codeInput}
                      value={props.state.code()}
                    />
                  </div>
                  <Button disabled={state.confirmDisabled()} onClick={props.state.totpConfirm} size="sm">
                    {state.confirmPending()
                      ? messageTranslate("common.loading")
                      : messageTranslate("account.factors.confirm")}
                  </Button>
                </div>
              )}
            </Show>
          </Show>
          <Show when={props.state.totpError()}>
            {(error) => <AuthenticatedNotice class="mt-3" message={error()} tone="danger" />}
          </Show>
          <div class="mt-3">
            <Button onClick={props.state.totpSetupDismiss} size="sm" variant="ghost">
              {messageTranslate("common.cancel")}
            </Button>
          </div>
        </AuthenticatedDialog>
      }
      class="h-full"
      description={messageTranslate("account.factors.description")}
      icon={mdiCellphoneKey}
      title={messageTranslate("account.security.authenticators")}
    >
      <AccountSecurityStatus
        configured={state.enrolled()}
        detail={messageTranslate("account.security.authenticatorCount", { count: state.enrollments().length })}
        label={messageTranslate(state.enrolled() ? "account.status.configured" : "account.status.notConfigured")}
      />
      <Show
        when={state.enrollments().length > 0}
        fallback={
          <p class="border-t border-line-subtle px-3 py-5 text-center text-sm text-muted-foreground">
            {messageTranslate("account.status.notConfigured")}
          </p>
        }
      >
        <ul class="divide-y divide-line-subtle border-t border-line-subtle">
          <For each={state.enrollments()}>
            {(enrollment) => (
              <li class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5">
                <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span class="min-w-0 truncate text-sm font-medium">{enrollment.label}</span>
                  <AuthenticatedStatus
                    label={
                      enrollment.status === "active"
                        ? messageTranslate("account.status.configured")
                        : messageTranslate("account.profile.verificationPending")
                    }
                    tone={enrollment.status === "active" ? "success" : "neutral"}
                  />
                </div>
                <Show when={enrollment.status === "active"}>
                  <AuthenticatedDialog
                    description={messageTranslate("account.factors.description")}
                    disabled={props.state.pendingId()?.startsWith("totp:")}
                    onOpenChange={(open) => state.renameDialogOpenSet(enrollment.id, enrollment.label, open)}
                    open={state.renameDialogOpen(enrollment.id)}
                    title={messageTranslate("account.factors.totp")}
                    triggerLabel={
                      <>
                        <Icon class="size-4" path={mdiPencil} />
                        <span class="sr-only">{messageTranslate("account.factors.totp")}</span>
                      </>
                    }
                    variant="outline"
                  >
                    <form class="grid gap-3" onSubmit={state.renameSubmit}>
                      <div class="grid gap-1">
                        <Label for={`account-totp-label-${enrollment.id}`}>
                          {messageTranslate("account.factors.authenticatorName")}
                        </Label>
                        <Input
                          disabled={props.state.pendingId() === `totp:rename:${enrollment.id}`}
                          id={`account-totp-label-${enrollment.id}`}
                          maxlength={128}
                          onInput={state.renameLabelInput}
                          required
                          value={state.renameLabel()}
                        />
                      </div>
                      <div class="flex flex-wrap justify-between gap-2">
                        <Button
                          disabled={props.state.pendingId() === `totp:rename:${enrollment.id}`}
                          size="sm"
                          type="submit"
                        >
                          {messageTranslate("common.save")}
                        </Button>
                        <Button
                          disabled={props.state.pendingId()?.startsWith("totp:")}
                          onClick={() => void state.renameRemove(enrollment.id)}
                          size="sm"
                          type="button"
                          variant="filledRed"
                        >
                          {messageTranslate("account.factors.removeTotp")}
                        </Button>
                      </div>
                    </form>
                  </AuthenticatedDialog>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <AuthenticatedDialog
        description={messageTranslate("account.factors.stepUpDescription")}
        onOpenChange={(open) => {
          if (!open) props.state.totpRemoveStepUpCancel()
        }}
        open={state.stepUpOpen()}
        title={messageTranslate("account.confirmTitle")}
      >
        <Show
          when={props.state.totpRemoveStepUpChallenge()}
          fallback={
            <Show
              when={props.state.totpRemoveStepUpPending()}
              fallback={
                <div class="grid gap-3">
                  <Show when={props.state.totpRemoveStepUpError()}>
                    {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                  </Show>
                  <div>
                    <Button
                      onClick={() => void props.state.totpRemoveStepUpStart(props.state.totpRemoveStepUpEnrollmentId())}
                      size="sm"
                      type="button"
                    >
                      {messageTranslate("common.retry")}
                    </Button>
                  </div>
                </div>
              }
            >
              <AccountFactorsSectionLoading />
            </Show>
          }
        >
          <form class="grid gap-3" onSubmit={state.stepUpSubmit}>
            <p class="text-sm text-muted-foreground">
              {messageTranslate(
                state.stepUpFactor() === "email_otp"
                  ? "account.factors.emailOtp"
                  : state.stepUpFactor() === "passkey"
                    ? "account.factors.passkeys"
                    : "account.factors.totp",
              )}
            </p>
            <div class="grid gap-1">
              <Label for="account-totp-step-up-code">{messageTranslate("account.factors.verificationCode")}</Label>
              <Input
                autocomplete="one-time-code"
                class="font-mono"
                disabled={props.state.totpRemoveStepUpPending()}
                id="account-totp-step-up-code"
                inputmode="numeric"
                maxlength={6}
                onInput={props.state.totpRemoveStepUpCodeInput}
                value={props.state.totpRemoveStepUpCode()}
              />
            </div>
            <Show when={props.state.totpRemoveStepUpError()}>
              {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
            </Show>
            <div class="flex flex-wrap gap-2">
              <Button
                disabled={props.state.totpRemoveStepUpPending() || !/^\d{6}$/.test(props.state.totpRemoveStepUpCode())}
                size="sm"
                type="submit"
              >
                {props.state.totpRemoveStepUpPending()
                  ? messageTranslate("common.loading")
                  : messageTranslate("common.continue")}
              </Button>
              <Button onClick={props.state.totpRemoveStepUpCancel} size="sm" type="button" variant="ghost">
                {messageTranslate("common.cancel")}
              </Button>
            </div>
          </form>
        </Show>
      </AuthenticatedDialog>
    </AuthenticatedSection>
  )
}

function AccountFactorsSectionLoading() {
  return (
    <div class="grid min-h-28 place-items-center text-center" role="status">
      <div>
        <LoaderSpin4Square class="mx-auto text-accent" />
        <p class="mt-3 text-sm text-muted-foreground">{messageTranslate("common.loading")}</p>
      </div>
    </div>
  )
}
