import { mdiAccount, mdiEmailOutline, mdiKey, mdiOpenInNew } from "@mdi/js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"

type MethodChoiceButtonProps = {
  detail: string
  label: string
  method: "password" | "email-otp" | "passkey" | "external-identity"
  onClick: () => void
}

export function MethodChoiceButton(props: MethodChoiceButtonProps) {
  const icon =
    props.method === "password"
      ? mdiKey
      : props.method === "email-otp"
        ? mdiEmailOutline
        : props.method === "passkey"
          ? mdiKey
          : mdiAccount
  return (
    <Button variant="outline" class="w-full justify-start gap-3 p-4 text-left" onClick={props.onClick}>
      <Icon path={icon} />
      <span class="flex flex-1 flex-col">
        <span class="font-semibold">{props.label}</span>
        <small class="text-muted-foreground">{props.detail}</small>
      </span>
      <Icon path={props.method === "external-identity" ? mdiOpenInNew : mdiKey} class="size-5 opacity-50" />
    </Button>
  )
}
