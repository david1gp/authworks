import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { AuthenticatedButton } from "./AuthenticatedButton.js"
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
      <AuthenticatedButton
        aria-label={`Copy ${props.label}`}
        class="shrink-0 text-muted-foreground hover:text-foreground"
        icon={state.copied() ? mdiCheck : mdiContentCopy}
        onClick={state.copy}
        size="sm"
        title={state.copied() ? "Copied" : `Copy ${props.label}`}
        variant="ghost"
      />
      <span aria-live="polite" class="sr-only">
        {state.copied() ? "Copied" : ""}
      </span>
    </span>
  )
}
