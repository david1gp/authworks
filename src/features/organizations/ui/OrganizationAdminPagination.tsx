import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Token-based pagination controls shared by every organization administration collection. */
export function OrganizationAdminPagination(props: {
  readonly nextAvailable: boolean
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly previousAvailable: boolean
}) {
  return (
    <Show when={props.nextAvailable || props.previousAvailable}>
      <div class="mt-4 flex justify-end gap-2">
        <Button disabled={!props.previousAvailable} onClick={props.onPrevious} variant="outline">
          {messageTranslate("admin.organizations.pagePrevious")}
        </Button>
        <Button disabled={!props.nextAvailable} onClick={props.onNext} variant="outline">
          {messageTranslate("admin.organizations.pageNext")}
        </Button>
      </div>
    </Show>
  )
}
