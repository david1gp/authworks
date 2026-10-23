import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedChipTone } from "./authenticatedChipTone.js"
import { authenticatedChipToneClassGet } from "./authenticatedChipToneClassGet.js"

/** Small pill for counts, flags, and categories; shorter than a status pill and dot-free. */
export function AuthenticatedChip(props: {
  readonly class?: string
  readonly icon?: string
  readonly label: string
  readonly tone?: AuthenticatedChipTone
}) {
  return (
    <span
      class={classMerge(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-px text-xs font-medium leading-5",
        authenticatedChipToneClassGet(props.tone ?? "neutral"),
        props.class,
      )}
    >
      <Show when={props.icon}>{(icon) => <Icon aria-hidden="true" class="size-3.5 shrink-0" path={icon()} />}</Show>
      <span class="truncate">{props.label}</span>
    </span>
  )
}
