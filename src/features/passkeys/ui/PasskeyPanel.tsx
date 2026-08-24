import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { PasskeyAuthenticationStatus } from "../public/passkeyAuthenticationStatusSchema.js"
import { passkeyPanelStateCreate } from "./passkeyPanelStateCreate.js"

type PasskeyPanelProps = {
  readonly errorMessage?: string
  readonly identifier: string
  readonly identifierInputRegister: (element: HTMLInputElement) => void
  readonly mfaContinuation: boolean
  readonly mfaAvailable?: boolean
  readonly onBack: () => void
  readonly onContinue: () => void
  readonly onIdentifier: (value: string) => void
  readonly onRememberIdentifier: (event: Event & { readonly currentTarget: HTMLInputElement }) => void
  readonly pending: boolean
  readonly rememberIdentifier: boolean
  readonly supported: boolean
  readonly status: PasskeyAuthenticationStatus
}

export function PasskeyPanel(props: PasskeyPanelProps) {
  const state = passkeyPanelStateCreate({
    mfaAvailable: () => props.mfaAvailable,
    mfaContinuation: () => props.mfaContinuation,
    supported: () => props.supported,
  })
  return (
    <section data-login-passkey-status={props.status}>
      <div class="flex items-start gap-3">
        <span class="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon path={mdiFingerprint} />
        </span>
        <div class="min-w-0">
          <LoginPanelHeader
            description={messageTranslate(
              !props.supported || props.status === "unsupported"
                ? "login.passkey.unsupported"
                : state.unavailable()
                  ? "login.mfa.passkeyUnavailableDescription"
                  : "login.passkey.description",
            )}
            title={messageTranslate(
              !props.supported || props.status === "unsupported"
                ? "login.passkey.unsupportedTitle"
                : state.unavailable()
                  ? "login.mfa.passkeyUnavailableTitle"
                  : props.mfaContinuation
                    ? "login.mfa.passkey"
                    : "login.passkey.title",
            )}
          />
        </div>
      </div>
      <div class="mt-6 grid gap-4">
        <Show when={props.errorMessage}>{(message) => <LoginMessages errorMessage={message()} />}</Show>
        <Show when={props.status === "permission-denied" && props.errorMessage === undefined}>
          <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {messageTranslate("common.error")}
          </p>
        </Show>
        <Show when={props.status === "ceremony-failure" && props.errorMessage === undefined}>
          <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {messageTranslate("common.error")}
          </p>
        </Show>
        <Show when={props.status === "pending"}>
          <p class="text-sm text-muted-foreground" role="status">
            {messageTranslate("login.common.working")}
          </p>
        </Show>
        <Show when={props.mfaContinuation && state.canVerify()}>
          <p class="text-sm text-muted-foreground" role="status">
            {messageTranslate("login.mfa.passkeyDescription")}
          </p>
        </Show>
        <Show
          when={state.canVerify() && props.status !== "unsupported"}
          fallback={<LoginBackLink disabled={props.pending} onBack={props.onBack} />}
        >
          <form
            class="grid gap-4"
            novalidate
            onSubmit={(event) => {
              event.preventDefault()
              props.onContinue()
            }}
          >
            <Show when={!props.mfaContinuation}>
              <div class="grid gap-2">
                <label class="text-sm font-medium" for="passkey-identifier">
                  {messageTranslate("login.password.identifier")}
                </label>
                <Input
                  ref={props.identifierInputRegister}
                  autocomplete="username"
                  id="passkey-identifier"
                  inputmode="email"
                  name="identifier"
                  onInput={(event) => props.onIdentifier(event.currentTarget.value)}
                  value={props.identifier}
                  disabled={props.pending}
                  maxlength="254"
                  type="text"
                />
                <label class="flex items-center gap-2 text-sm text-muted-foreground" for="passkey-remember">
                  <input
                    checked={props.rememberIdentifier}
                    disabled={props.pending}
                    id="passkey-remember"
                    onChange={props.onRememberIdentifier}
                    type="checkbox"
                  />
                  {messageTranslate("login.password.rememberIdentifier")}
                </label>
              </div>
            </Show>
            <LoginSubmitButton
              label={
                props.mfaContinuation
                  ? messageTranslate("login.mfa.passkeyVerify")
                  : props.status === "permission-denied" ||
                      props.status === "ceremony-failure" ||
                      props.status === "failure"
                    ? messageTranslate("common.retry")
                    : messageTranslate("login.passkey.submit")
              }
              pending={props.pending || props.status === "pending"}
              pendingLabel={messageTranslate("login.common.working")}
            />
          </form>
          <LoginBackLink disabled={props.pending} onBack={props.onBack} />
        </Show>
      </div>
    </section>
  )
}
