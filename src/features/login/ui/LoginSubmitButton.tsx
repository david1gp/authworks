import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function LoginSubmitButton(props: {
  readonly label: string
  readonly icon: string
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly pendingLabel?: string
  readonly pending: boolean
  readonly type?: "button" | "submit"
}) {
  return (
    <ButtonIcon
      aria-busy={props.pending ? "true" : undefined}
      class="w-full bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      disabled={props.pending || props.disabled === true}
      icon={props.icon}
      onClick={props.onClick}
      type={props.type ?? "submit"}
      variant="filledBlue"
    >
      {props.pending ? (props.pendingLabel ?? messageTranslate("login.common.working")) : props.label}
    </ButtonIcon>
  )
}
