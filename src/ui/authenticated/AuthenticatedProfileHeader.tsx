import type { JSX } from "solid-js"
import { children, For, Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedProfileHeaderMeta } from "./authenticatedProfileHeaderMeta.js"

/**
 * Profile header card: avatar slot, title, subtitle, chips row, label/value meta row, and an
 * actions slot. Stacks vertically on narrow viewports.
 */
export function AuthenticatedProfileHeader(props: {
  readonly actions?: JSX.Element
  readonly avatar?: JSX.Element
  readonly chips?: JSX.Element
  readonly class?: string
  readonly meta?: readonly AuthenticatedProfileHeaderMeta[]
  readonly subtitle?: JSX.Element
  readonly title: JSX.Element
}) {
  const actions = children(() => props.actions)
  const avatar = children(() => props.avatar)
  const chips = children(() => props.chips)
  const subtitle = children(() => props.subtitle)
  return (
    <section class={classMerge("rounded-panel border border-line bg-surface p-5 shadow-panel sm:px-6", props.class)}>
      <div class="flex flex-wrap items-start gap-4">
        <Show when={avatar.toArray().length > 0}>
          <div class="shrink-0">{avatar()}</div>
        </Show>
        <div class="grid min-w-0 flex-1 gap-1">
          <h2 class="min-w-0 truncate text-lg font-semibold tracking-tight">{props.title}</h2>
          <Show when={subtitle.toArray().length > 0}>
            <div class="min-w-0 truncate text-sm text-muted-foreground">{subtitle()}</div>
          </Show>
          <Show when={chips.toArray().length > 0}>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">{chips()}</div>
          </Show>
        </div>
        <Show when={actions.toArray().length > 0}>
          <div class="flex shrink-0 flex-wrap items-center gap-1.5">{actions()}</div>
        </Show>
      </div>
      <Show when={(props.meta?.length ?? 0) > 0}>
        <dl class="mt-4 grid gap-x-6 gap-y-3 border-t border-line-subtle pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <For each={props.meta ?? []}>
            {(entry) => (
              <div class="min-w-0">
                <dt class="text-2xs font-medium tracking-wide text-muted-foreground uppercase">{entry.label}</dt>
                <dd class="mt-0.5 min-w-0 truncate text-sm font-medium">{entry.value}</dd>
              </div>
            )}
          </For>
        </dl>
      </Show>
    </section>
  )
}
