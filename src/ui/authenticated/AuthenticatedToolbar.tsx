import type { JSX } from "solid-js"
import { children, Show } from "solid-js"

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
  const actions = children(() => props.actions)

  return (
    <div
      aria-label={props.label}
      class="flex flex-wrap items-center gap-x-3 gap-y-2.5 [&_input[type=search]]:w-full sm:[&_input[type=search]]:w-auto"
      role="group"
    >
      <Show when={props.children}>
        {(children) => (
          <div class="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1">{children()}</div>
        )}
      </Show>
      <Show when={props.summary || actions.toArray().length > 0}>
        <div class="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
          <Show when={props.summary}>
            {(summary) => <span class="text-[0.8125rem] tabular-nums text-muted-foreground">{summary()}</span>}
          </Show>
          <Show when={actions.toArray().length > 0}>
            <div class="ms-auto flex items-center gap-1.5">{actions()}</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
