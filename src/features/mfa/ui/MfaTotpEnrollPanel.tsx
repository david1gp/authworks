import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import { mfaTotpEnrollPanelStateCreate } from "./mfaTotpEnrollPanelStateCreate.js"

type MfaTotpEnrollPanelProps = {
  readonly code: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onStart: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly otpauthUri?: string
  readonly secret?: string
  readonly setupUnavailable?: boolean
  readonly validationMessage?: string
}

export function MfaTotpEnrollPanel(props: MfaTotpEnrollPanelProps) {
  const state = mfaTotpEnrollPanelStateCreate(
    () => props.secret,
    () => props.otpauthUri,
  )
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.totpEnroll.description")}
        title={messageTranslate("login.totpEnroll.title")}
      />
      <Show
        when={!props.setupUnavailable}
        fallback={
          <div class="mt-6 grid gap-4">
            <p
              class="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              {messageTranslate("login.totpEnroll.unavailableDescription")}
            </p>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
          </div>
        }
      >
        <Show
          when={props.secret}
          fallback={
            <div class="mt-6 grid gap-4">
              <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
              <LoginSubmitButton
                label={messageTranslate("login.totpEnroll.start")}
                onClick={props.onStart}
                pending={props.pending}
                type="button"
              />
            </div>
          }
        >
          <form class="mt-6 grid gap-5" novalidate onSubmit={props.onSubmit}>
            <p class="text-sm leading-6 text-muted-foreground">
              {messageTranslate("login.totpEnroll.scanDescription")}
            </p>
            <Show when={state.qr()}>
              {(qr) => (
                <svg
                  aria-label={messageTranslate("login.totpEnroll.qrLabel")}
                  class="mx-auto size-48 max-w-full rounded-lg bg-white p-3 sm:size-56"
                  role="img"
                  shape-rendering="crispEdges"
                  viewBox={`0 0 ${qr().viewBoxSize} ${qr().viewBoxSize}`}
                >
                  <rect fill="white" height={qr().viewBoxSize} width={qr().viewBoxSize} />
                  <path d={qr().path} fill="black" />
                </svg>
              )}
            </Show>
            <div class="min-w-0 rounded-lg border border-line bg-surface-muted p-4" role="group">
              <p class="text-sm font-semibold" id="totp-secret-label">
                {messageTranslate("login.totpEnroll.setupKeyLabel")}
              </p>
              <Show
                when={state.secretVisible()}
                fallback={
                  <Button
                    class="mt-3 w-full sm:w-auto"
                    onClick={state.secretVisibleToggle}
                    type="button"
                    variant="outline"
                  >
                    {messageTranslate("login.totpEnroll.showSetupKey")}
                  </Button>
                }
              >
                <p class="mt-3 break-all font-mono text-sm tracking-[0.18em]" aria-describedby="totp-secret-label">
                  <For each={state.secretGroups()}>{(group) => <span class="mr-2 inline-block">{group}</span>}</For>
                </p>
                <Button
                  class="mt-3 w-full sm:w-auto"
                  onClick={state.secretVisibleToggle}
                  type="button"
                  variant="outline"
                >
                  {messageTranslate("login.totpEnroll.hideSetupKey")}
                </Button>
              </Show>
            </div>
            <div class="grid gap-2">
              <Label for="totp-enroll-code">{messageTranslate("login.mfa.verificationCode")}</Label>
              <Input
                autocomplete="one-time-code"
                id="totp-enroll-code"
                inputmode="numeric"
                maxlength="6"
                name="code"
                pattern="[0-9]{6}"
                onInput={(event) => props.onCode(event.currentTarget.value)}
                value={props.code}
                aria-describedby="totp-enroll-code-help"
              />
              <p class="text-xs text-muted-foreground" id="totp-enroll-code-help">
                {messageTranslate("login.mfa.enterSixDigits")}
              </p>
            </div>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
            <LoginSubmitButton
              disabled={props.code.length !== 6}
              label={messageTranslate("login.totpEnroll.submit")}
              pending={props.pending}
            />
          </form>
        </Show>
      </Show>
      <LoginBackLink
        disabled={props.pending}
        label={messageTranslate("login.mfa.backToChoices")}
        onBack={props.onBack}
      />
    </section>
  )
}
