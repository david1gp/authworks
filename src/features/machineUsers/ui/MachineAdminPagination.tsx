import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Token-based pagination controls shared by every machine-user administration collection. */
export function MachineAdminPagination(props: {
  readonly hasNext: boolean
  readonly hasPrevious: boolean
  readonly onNext: () => void
  readonly onPrevious: () => void
}) {
  return (
    <Show when={props.hasNext || props.hasPrevious}>
      <div class="mt-4 flex justify-end gap-2">
        <Button disabled={!props.hasPrevious} onClick={props.onPrevious} variant="outline">
          {messageTranslate("admin.machine.pagePrevious")}
        </Button>
        <Button disabled={!props.hasNext} onClick={props.onNext} variant="outline">
          {messageTranslate("admin.machine.pageNext")}
        </Button>
      </div>
    </Show>
  )
}
