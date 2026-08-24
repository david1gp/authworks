import { mdiCellphoneKey } from "@adaptive-ds/mdi/mdiCellphoneKey.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { mdiLifebuoy } from "@adaptive-ds/mdi/mdiLifebuoy.js"
import { For, Match, Show, Switch } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MfaFactor } from "../model/mfaFactorSchema.js"
import type { MfaPanelMode } from "../model/mfaPanelModeSchema.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { mfaPanelStateCreate } from "./mfaPanelStateCreate.js"

const factorIcons: Readonly<Record<MfaFactor, string>> = {
  "email-otp": mdiEmailOutline,
  passkey: mdiFingerprint,
  "recovery-code": mdiLifebuoy,
  totp: mdiCellphoneKey,
}

export function MfaPanel(props: {
  readonly errorMessage?: string
  readonly factorAvailability?: Partial<Record<MfaFactor, boolean>>
  readonly factors: readonly MfaFactor[]
  readonly mode?: MfaPanelMode
  readonly onBack: () => void
  readonly onContinue?: () => void
  readonly onRetry?: () => void
  readonly onSelect: (factor: MfaFactor) => void
  readonly onSkip?: () => void
  readonly pending?: boolean
}) {
  const state = mfaPanelStateCreate({
    factorAvailability: () => props.factorAvailability,
    factors: () => props.factors,
    mode: () => props.mode ?? "select",
    onSelect: props.onSelect,
  })

  return (
    <section aria-labelledby="mfa-panel-title">
      <Switch>
        <Match when={state.mode() === "loading"}>
          <div class="grid justify-items-center gap-4 py-8 text-center" role="status">
            <LoaderShuffle4Dots />
            <LoginPanelHeader
              headingId="mfa-panel-title"
              title={messageTranslate("login.mfa.loadingOptions")}
              description={messageTranslate("login.mfa.loadingOptionsDescription")}
            />
          </div>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.mfa.backToMethods")}
            onBack={props.onBack}
          />
        </Match>
        <Match when={state.mode() === "unavailable"}>
          <LoginPanelHeader
            headingId="mfa-panel-title"
            title={messageTranslate("login.mfa.optionsUnavailableTitle")}
            description={messageTranslate("login.mfa.optionsUnavailableDescription")}
          />
          <div class="mt-6 grid gap-4">
            <LoginMessages errorMessage={props.errorMessage} />
            <LoginSubmitButton
              label={messageTranslate("login.mfa.retryOptions")}
              onClick={props.onRetry}
              pending={props.pending === true}
              type="button"
            />
          </div>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.mfa.backToMethods")}
            onBack={props.onBack}
          />
        </Match>
        <Match when={state.mode() === "satisfied"}>
          <LoginPanelHeader
            headingId="mfa-panel-title"
            title={messageTranslate("login.mfa.satisfiedTitle")}
            description={messageTranslate("login.mfa.satisfiedDescription")}
          />
          <div class="mt-6">
            <LoginSubmitButton
              label={messageTranslate("login.mfa.continue")}
              onClick={props.onContinue}
              pending={props.pending === true}
              type="button"
            />
          </div>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.mfa.backToMethods")}
            onBack={props.onBack}
          />
        </Match>
        <Match when={state.mode() === "optional"}>
          <LoginPanelHeader
            headingId="mfa-panel-title"
            title={messageTranslate("login.mfa.optionalTitle")}
            description={messageTranslate("login.mfa.optionalDescription")}
          />
          <div class="mt-6 grid gap-3">
            <For each={state.factorItems()}>
              {(item) => (
                <FactorButton
                  available={item.available}
                  detail={item.detail}
                  factor={item.factor}
                  icon={factorIcons[item.factor]}
                  label={item.label}
                  onSelect={state.selectFactor}
                  setup
                />
              )}
            </For>
            <Button class="w-full" disabled={props.pending} onClick={props.onSkip} type="button" variant="outline">
              {props.pending ? messageTranslate("login.mfa.skipping") : messageTranslate("login.mfa.skip")}
            </Button>
          </div>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.mfa.backToMethods")}
            onBack={props.onBack}
          />
        </Match>
        <Match when={state.mode() === "enroll" || state.mode() === "select"}>
          <LoginPanelHeader
            headingId="mfa-panel-title"
            title={messageTranslate(state.mode() === "enroll" ? "login.mfa.enrollTitle" : "login.mfa.title")}
            description={messageTranslate(
              state.mode() === "enroll" ? "login.mfa.enrollDescription" : "login.mfa.description",
            )}
          />
          <div class="mt-6 grid gap-3">
            <For each={state.factorItems()}>
              {(item) => (
                <FactorButton
                  available={item.available}
                  detail={item.detail}
                  factor={item.factor}
                  icon={factorIcons[item.factor]}
                  label={item.label}
                  onSelect={state.selectFactor}
                  setup={state.mode() === "enroll"}
                />
              )}
            </For>
          </div>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.mfa.backToMethods")}
            onBack={props.onBack}
          />
        </Match>
      </Switch>
    </section>
  )
}

function FactorButton(props: {
  readonly available: boolean
  readonly detail: MessageKey
  readonly factor: MfaFactor
  readonly icon: string
  readonly label: MessageKey
  readonly onSelect: (factor: MfaFactor) => void
  readonly setup: boolean
}) {
  return (
    <Button
      aria-describedby={`mfa-factor-${props.factor}-detail`}
      class="w-full min-w-0 items-start justify-start gap-3 p-4 text-left"
      disabled={!props.available}
      onClick={() => props.onSelect(props.factor)}
      type="button"
      variant="outline"
    >
      <Icon class="mt-0.5 shrink-0" path={props.icon} />
      <span class="min-w-0">
        <span class="block truncate font-semibold">
          {props.setup
            ? messageTranslate("login.mfa.setupFactor", { factor: messageTranslate(props.label) })
            : messageTranslate(props.label)}
        </span>
        <span class="mt-1 block text-sm font-normal text-muted-foreground" id={`mfa-factor-${props.factor}-detail`}>
          {props.available ? messageTranslate(props.detail) : messageTranslate("login.mfa.factorUnavailable")}
        </span>
      </span>
      <Show when={!props.available}>
        <span class="ml-auto shrink-0 text-xs text-muted-foreground">{messageTranslate("login.mfa.unavailable")}</span>
      </Show>
    </Button>
  )
}
