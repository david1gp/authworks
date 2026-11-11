import { mdiArrowDown } from "@adaptive-ds/mdi/mdiArrowDown.js"
import { mdiArrowUp } from "@adaptive-ds/mdi/mdiArrowUp.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { AuthenticatedButton } from "./AuthenticatedButton.js"
import { AuthenticatedSelect } from "./AuthenticatedSelect.js"
import type { AuthenticatedDataTableSort } from "./authenticatedDataTableSort.js"
import { authenticatedSortSelectStateCreate } from "./authenticatedSortSelectStateCreate.js"
export function AuthenticatedSortSelect(props: {
  readonly label: string
  readonly onSortChange: (sort: AuthenticatedDataTableSort) => void
  readonly options: readonly { readonly key: string; readonly label: string }[]
  readonly sort: AuthenticatedDataTableSort
}) {
  const state = authenticatedSortSelectStateCreate({
    sort: () => props.sort,
    onSortChange: (sort) => props.onSortChange(sort),
  })
  return (
    <div class="flex min-w-0 items-center gap-1">
      <AuthenticatedSelect
        aria-label={props.label}
        valueSignal={state.valueSignal}
        getOptions={() => props.options.map((option) => option.key)}
        valueText={(value) => props.options.find((option) => option.key === value)?.label ?? value}
      />
      <AuthenticatedButton
        variant="ghost"
        size="sm"
        icon={props.sort.direction === "asc" ? mdiArrowUp : mdiArrowDown}
        aria-label={messageTranslate(
          props.sort.direction === "asc" ? "ui.authenticated.sortDescending" : "ui.authenticated.sortAscending",
        )}
        onClick={state.toggle}
      />
    </div>
  )
}
