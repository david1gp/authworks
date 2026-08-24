import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function LoginSubmitButton(props: {
  readonly label: string
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly pendingLabel?: string
  readonly pending: boolean
  readonly type?: "button" | "submit"
}) {
  return (
    <Button
      aria-busy={props.pending ? "true" : undefined}
      class="w-full bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      disabled={props.pending || props.disabled === true}
      onClick={props.onClick}
      type={props.type ?? "submit"}
      variant="filledBlue"
    >
      {props.pending ? (props.pendingLabel ?? messageTranslate("login.common.working")) : props.label}
    </Button>
  )
}
