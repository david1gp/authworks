import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { mdiKeyOutline } from "@adaptive-ds/mdi/mdiKeyOutline.js"
import { mdiWhatsapp } from "@adaptive-ds/mdi/mdiWhatsapp.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { ExternalIdentityIcon } from "../../externalIdentities/ui/ExternalIdentityIcon.js"
import type { LoginPrimaryMethod } from "../model/loginPrimaryMethodsGet.js"

type MethodChoiceButtonProps = {
  readonly detail: string
  readonly label: string
  readonly lastUsed?: boolean
  readonly method: LoginPrimaryMethod
  readonly onClick: () => void
  readonly pending?: boolean
  readonly providerType?: ExternalIdentityProviderType
}

export function MethodChoiceButton(props: MethodChoiceButtonProps) {
  // Apple Human Interface Guidelines require the approved black (or white) button with the
  // Apple logo and "Sign in with Apple" text. The contrast variant renders exactly those
  // two styles and adapts to the theme.
  const apple = () => props.method === "external-identity" && props.providerType === "apple"
  return (
    <Button
      class={[
        apple()
          ? "w-full min-h-[66px] min-w-0 justify-start gap-3.5 rounded-[10px] border-line px-[15px] py-3 text-left"
          : "w-full min-h-[66px] min-w-0 justify-start gap-3.5 rounded-[10px] border-line px-[15px] py-3 text-left hover:bg-surface-hover",
        { "border-accent ring-1 ring-inset ring-accent": props.lastUsed && !apple() },
      ]}
      disabled={props.pending}
      onClick={props.onClick}
      type="button"
      variant={apple() ? "contrast" : "outline"}
    >
      <Show
        when={props.method === "external-identity" && props.providerType}
        fallback={
          <Icon
            class="size-8 shrink-0"
            path={
              props.method === "email-otp"
                ? mdiEmailOutline
                : props.method === "whatsapp-otp"
                  ? mdiWhatsapp
                  : props.method === "passkey"
                    ? mdiFingerprint
                    : mdiKeyOutline
            }
          />
        }
      >
        {(type) => <ExternalIdentityIcon class="size-8 shrink-0" type={type()} />}
      </Show>
      <span
        class={
          apple()
            ? "grid min-w-0 flex-1 [&>span]:min-w-0 [&>span]:font-extrabold [&>span]:[overflow-wrap:anywhere] [&_small]:mt-[3px] [&_small]:text-white/70 dark:[&_small]:text-slate-900/70"
            : "grid min-w-0 flex-1 [&>span]:min-w-0 [&>span]:font-extrabold [&>span]:[overflow-wrap:anywhere] [&_small]:mt-[3px] [&_small]:text-muted-foreground"
        }
      >
        <span>
          {apple() ? messageTranslate("login.provider.appleSubmit") : props.label}
          <Show when={props.lastUsed}>
            <span class="ms-2 inline-block max-w-full rounded-full bg-accent px-2 py-0.5 align-middle text-[0.6875rem] font-extrabold leading-none text-accent-contrast [overflow-wrap:anywhere]">
              {messageTranslate("login.chooser.lastUsed")}
            </span>
          </Show>
        </span>
        <small>{props.detail}</small>
      </span>
    </Button>
  )
}
