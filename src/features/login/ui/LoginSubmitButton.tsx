import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function LoginSubmitButton(props: {
  readonly label: string
  readonly onClick?: () => void
  readonly pending: boolean
  readonly type?: "button" | "submit"
}) {
  return (
    <Button
      aria-busy={props.pending ? "true" : undefined}
      class="w-full"
      disabled={props.pending}
      onClick={props.onClick}
      type={props.type ?? "submit"}
      variant="filledBlue"
    >
      {props.pending ? messageTranslate("login.common.working") : props.label}
    </Button>
  )
}
