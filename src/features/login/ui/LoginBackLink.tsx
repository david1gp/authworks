import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

export function LoginBackLink(props: {
  readonly disabled?: boolean
  readonly label?: string
  readonly onBack: () => void
}) {
  return (
    <Button class="mt-4 w-full gap-1.5" disabled={props.disabled} onClick={props.onBack} type="button" variant="link">
      <Icon class="size-4" path={mdiArrowLeft} />
      {props.label ?? messageTranslate("login.common.back")}
    </Button>
  )
}
