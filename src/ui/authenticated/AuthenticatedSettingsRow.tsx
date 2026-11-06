import type { JSX } from "solid-js"
import { Show } from "solid-js"

/** Label and control row for use within an AuthenticatedSettingsList. */
export function AuthenticatedSettingsRow(props: {
  readonly badge?: JSX.Element
  readonly children: JSX.Element
  readonly description?: JSX.Element
  readonly htmlFor?: string
  readonly label: JSX.Element
}) {
  return (
    <div class="grid gap-2 py-3 md:grid-cols-[minmax(200px,280px)_1fr] md:gap-6">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <label for={props.htmlFor} class="text-sm font-medium">
            {props.label}
          </label>
          {props.badge}
        </div>
        <Show when={props.description}>
          <div class="mt-1 text-xs text-muted-foreground">{props.description}</div>
        </Show>
      </div>
      <div class="min-w-0">{props.children}</div>
    </div>
  )
}
