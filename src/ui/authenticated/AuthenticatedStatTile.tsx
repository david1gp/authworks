import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Compact KPI tile: label, prominent value, optional hint, and an optional link target that
 * wraps the tile without nesting interactive children.
 */
export function AuthenticatedStatTile(props: {
  readonly class?: string
  readonly hint?: string
  readonly href?: string
  readonly label: string
  readonly value: JSX.Element
}) {
  const body = (
    <>
      <p class="truncate text-2xs font-medium tracking-wide text-muted-foreground uppercase">{props.label}</p>
      <p class="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{props.value}</p>
      <Show when={props.hint}>
        {(hint) => <p class="mt-1 line-clamp-2 text-[0.8125rem] leading-5 text-muted-foreground">{hint()}</p>}
      </Show>
    </>
  )
  return (
    <Show
      when={typeof props.href === "string" && props.href.length > 0}
      fallback={
        <div class={classMerge("rounded-panel border border-line bg-surface p-4 shadow-panel", props.class)}>
          {body}
        </div>
      }
    >
      {(href) => (
        <A
          aria-label={props.label}
          class={classMerge(
            "block rounded-panel border border-line bg-surface p-4 shadow-panel transition-colors hover:border-line-strong hover:bg-surface-hover",
            props.class,
          )}
          href={String(href())}
        >
          {body}
        </A>
      )}
    </Show>
  )
}
