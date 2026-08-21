import { mdiChevronRight, mdiEmailOutline, mdiFingerprint, mdiKeyOutline } from "@mdi/js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { ExternalIdentityIcon } from "../../externalIdentities/ui/ExternalIdentityIcon.js"
import type { LoginPrimaryMethod } from "../model/loginPrimaryMethodsGet.js"

type MethodChoiceButtonProps = {
  readonly detail: string
  readonly label: string
  readonly method: LoginPrimaryMethod
  readonly onClick: () => void
  readonly providerType?: ExternalIdentityProviderType
}

export function MethodChoiceButton(props: MethodChoiceButtonProps) {
  return (
    <Button
      class="w-full min-w-0 justify-start gap-3 p-4 text-left"
      onClick={props.onClick}
      type="button"
      variant="outline"
    >
      <Show
        when={props.method === "external-identity" && props.providerType}
        fallback={
          <Icon
            class="shrink-0"
            path={
              props.method === "email-otp"
                ? mdiEmailOutline
                : props.method === "passkey"
                  ? mdiFingerprint
                  : mdiKeyOutline
            }
          />
        }
      >
        {(type) => <ExternalIdentityIcon class="shrink-0" type={type()} />}
      </Show>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-semibold">{props.label}</span>
        <small class="truncate text-muted-foreground">{props.detail}</small>
      </span>
      <Icon class="size-5 shrink-0 opacity-50" path={mdiChevronRight} />
    </Button>
  )
}
