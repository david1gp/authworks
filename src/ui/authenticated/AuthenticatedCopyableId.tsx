import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { authenticatedCopyableIdStateCreate } from "./authenticatedCopyableIdStateCreate.js"

/** A readable identifier with a copy action and the complete value in its title. */
export function AuthenticatedCopyableId(props: {
  readonly full?: boolean
  readonly label: string
  readonly value: string
}) {
  const state = authenticatedCopyableIdStateCreate(() => props.value)
  return (
    <span class="inline-flex min-w-0 items-center gap-1">
      <span class="truncate font-mono text-xs" title={props.value}>
        {props.full ? props.value : state.text()}
      </span>
      <button
        aria-label={`Copy ${props.label}`}
        class="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        onClick={state.copy}
        title={state.copied() ? "Copied" : `Copy ${props.label}`}
        type="button"
      >
        <Icon aria-hidden="true" class="size-4" path={state.copied() ? mdiCheck : mdiContentCopy} />
      </button>
      <span aria-live="polite" class="sr-only">
        {state.copied() ? "Copied" : ""}
      </span>
    </span>
  )
}
