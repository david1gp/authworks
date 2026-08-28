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
      {/* The bar also carries description-only and action-only panels, so a section whose name is
          already spoken by the page heading can drop its title without losing its controls. */}
      <Show when={props.title !== undefined || props.description !== undefined || props.actions !== undefined}>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-subtle px-3 py-2">
          <div class="min-w-0">
            <Show when={props.title}>
              {(title) => <h2 class="truncate text-sm font-semibold tracking-tight">{title()}</h2>}
            </Show>
            <Show when={props.description}>
              {(description) => (
                <p class={classMerge("text-xs text-muted-foreground", props.title ? "mt-0.5" : undefined)}>
                  {description()}
                </p>
              )}
            </Show>
          </div>
          <Show when={props.actions}>
            {(actions) => <div class="flex flex-wrap items-center gap-1.5">{actions()}</div>}
          </Show>
        </div>
      </Show>
      <div class={props.padded ? "px-3 py-2.5" : undefined}>{props.children}</div>
    </section>
  )
}
