import type { JSX } from "solid-js"
import { Show } from "solid-js"

/**
 * Dense filter/action bar. Search and filters sit at the start, a live result summary and actions at
 * the end, so a collection page keeps a single 40px control row above its data.
 */
export function AuthenticatedToolbar(props: {
  readonly actions?: JSX.Element
  readonly children?: JSX.Element
  readonly label: string
  readonly summary?: string
}) {
  return (
    <div aria-label={props.label} class="flex flex-wrap items-center gap-x-3 gap-y-2" role="group">
      <Show when={props.children}>
        {(children) => <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children()}</div>}
      </Show>
      <Show when={props.summary}>
        {(summary) => <span class="text-xs tabular-nums text-muted-foreground">{summary()}</span>}
      </Show>
      <Show when={props.actions}>{(actions) => <div class="flex items-center gap-1.5">{actions()}</div>}</Show>
    </div>
  )
}
