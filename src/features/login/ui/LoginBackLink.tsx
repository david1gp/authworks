import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function LoginBackLink(props: {
  readonly disabled?: boolean
  readonly label?: string
  readonly onBack: () => void
}) {
  return (
    <Button class="mt-4 w-full" disabled={props.disabled} onClick={props.onBack} type="button" variant="link">
      {props.label ?? messageTranslate("login.common.back")}
    </Button>
  )
}
