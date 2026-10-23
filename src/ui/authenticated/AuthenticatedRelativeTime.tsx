import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedRelativeTimeStateCreate } from "./authenticatedRelativeTimeStateCreate.js"

/**
 * Relative timestamp (`5 minutes ago`) that exposes the absolute local time in its `title` and
 * `datetime` attributes. Renders the `fallback` slot (for example a translated "Never") when no
 * date is available.
 */
export function AuthenticatedRelativeTime(props: {
  readonly class?: string
  readonly fallback?: JSX.Element
  readonly value?: Date | number | string | null
}) {
  const state = authenticatedRelativeTimeStateCreate(() => props.value)
  return (
    <Show when={state.text()} fallback={props.fallback}>
      {(text) => (
        <time class={classMerge("tabular-nums", props.class)} dateTime={state.dateTime()} title={state.absolute()}>
          {text()}
        </time>
      )}
    </Show>
  )
}
