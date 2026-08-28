import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedStatusTone } from "./authenticatedStatusTone.js"
import { authenticatedStatusToneClassGet } from "./authenticatedStatusToneClassGet.js"

/** Compact status pill with a leading dot, sized to sit inline in a dense table row. */
export function AuthenticatedStatus(props: {
  readonly class?: string
  readonly label: string
  readonly tone: AuthenticatedStatusTone
}) {
  return (
    <span
      class={classMerge(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-5 font-medium",
        authenticatedStatusToneClassGet(props.tone),
        props.class,
      )}
    >
      <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-current" />
      <span class="truncate">{props.label}</span>
    </span>
  )
}
