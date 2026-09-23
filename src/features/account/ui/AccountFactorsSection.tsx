import { mdiCellphoneKey } from "@adaptive-ds/mdi/mdiCellphoneKey.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { mdiArrowRight } from "@adaptive-ds/mdi/mdiArrowRight.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
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
          triggerIcon={mdiCellphoneKey}
          variant="outline"
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
                  <ButtonIcon disabled={state.confirmDisabled()} icon={mdiCheck} onClick={props.state.totpConfirm}>
                    {state.confirmPending()
                      ? messageTranslate("common.loading")
                      : messageTranslate("account.factors.confirm")}
                  </ButtonIcon>
                </div>
              )}
            </Show>
          </Show>
          <Show when={props.state.totpError()}>
            {(error) => <AuthenticatedNotice class="mt-3" message={error()} tone="danger" />}
          </Show>
          <div class="mt-3">
            <ButtonIcon icon={mdiClose} onClick={props.state.totpSetupDismiss} variant="ghost">
              {messageTranslate("common.cancel")}
            </ButtonIcon>
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
                        <ButtonIcon
                          disabled={props.state.pendingId() === `totp:rename:${enrollment.id}`}
                          icon={mdiContentSave}
                          type="submit"
                        >
                          {messageTranslate("common.save")}
                        </ButtonIcon>
                        <ButtonIcon
                          disabled={props.state.pendingId()?.startsWith("totp:")}
                          icon={mdiDelete}
                          onClick={() => void state.renameRemove(enrollment.id)}
                          type="button"
                          variant="filledRed"
                        >
                          {messageTranslate("account.factors.removeTotp")}
                        </ButtonIcon>
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
                    <ButtonIcon
                      icon={mdiRefresh}
                      onClick={() => void props.state.totpRemoveStepUpStart(props.state.totpRemoveStepUpEnrollmentId())}
                      type="button"
                    >
                      {messageTranslate("common.retry")}
                    </ButtonIcon>
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
              <ButtonIcon
                disabled={props.state.totpRemoveStepUpPending() || !/^\d{6}$/.test(props.state.totpRemoveStepUpCode())}
                icon={mdiArrowRight}
                type="submit"
              >
                {props.state.totpRemoveStepUpPending()
                  ? messageTranslate("common.loading")
                  : messageTranslate("common.continue")}
              </ButtonIcon>
              <ButtonIcon icon={mdiClose} onClick={props.state.totpRemoveStepUpCancel} type="button" variant="ghost">
                {messageTranslate("common.cancel")}
              </ButtonIcon>
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
