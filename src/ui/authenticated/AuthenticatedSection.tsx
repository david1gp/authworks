import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Hairline authenticated panel with an optional dense title bar. Content is unpadded by default so
 * tables and lists can bleed to the panel edge; pass `padded` for prose and form content.
 */
export function AuthenticatedSection(props: {
  readonly actions?: JSX.Element
  readonly children: JSX.Element
  readonly class?: string
  readonly description?: string
  readonly label?: string
  readonly padded?: boolean
  readonly title?: string
}) {
  return (
    <section
      aria-label={props.label ?? props.title}
      class={classMerge("overflow-hidden rounded-panel border border-line bg-surface", props.class)}
    >
      <Show when={props.title}>
        {(title) => (
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-3 py-2">
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold tracking-tight">{title()}</h2>
              <Show when={props.description}>
                {(description) => <p class="mt-0.5 text-xs text-muted-foreground">{description()}</p>}
              </Show>
            </div>
            <Show when={props.actions}>
              {(actions) => <div class="flex flex-wrap items-center gap-1.5">{actions()}</div>}
            </Show>
          </div>
        )}
      </Show>
      <div class={props.padded ? "px-3 py-2.5" : undefined}>{props.children}</div>
    </section>
  )
}
