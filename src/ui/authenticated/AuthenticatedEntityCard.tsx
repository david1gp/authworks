import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedCardClasses } from "./authenticatedCardClasses.js"
import { authenticatedEntityCardStateCreate } from "./authenticatedEntityCardStateCreate.js"

export function AuthenticatedEntityCard(props: {
  readonly actions?: JSX.Element
  readonly children?: JSX.Element
  readonly class?: string
  readonly entityId?: string
  readonly footer?: JSX.Element
  readonly href?: string
  readonly label: string
  readonly leading?: JSX.Element
  readonly onActivate?: () => void
  readonly status?: JSX.Element
  readonly title: JSX.Element
}) {
  const state = authenticatedEntityCardStateCreate({ onActivate: () => props.onActivate })
  return (
    <li
      data-entity-id={props.entityId}
      class={classMerge(
        authenticatedCardClasses.card,
        (props.href || props.onActivate) && authenticatedCardClasses.cardInteractive,
        props.class,
      )}
      role={!props.href && props.onActivate ? "button" : undefined}
      tabIndex={!props.href && props.onActivate ? 0 : undefined}
      aria-label={!props.href && props.onActivate ? props.label : undefined}
      onClick={!props.href && props.onActivate ? state.activate : undefined}
      onKeyDown={!props.href && props.onActivate ? state.keyDown : undefined}
    >
      <div class="flex min-w-0 items-center gap-1.5">
        {props.leading}
        <div class="min-w-0 flex-1 text-sm font-semibold">
          <Show when={props.href} fallback={props.title}>
            {(href) => (
              <A href={href()} aria-label={props.label} class="after:absolute after:inset-0">
                {props.title}
              </A>
            )}
          </Show>
        </div>
        <Show when={props.status}>
          <div class="relative z-10">{props.status}</div>
        </Show>
        <Show when={props.actions}>
          <div class="relative z-10">{props.actions}</div>
        </Show>
      </div>
      {props.children}
      <Show when={props.footer}>
        <div class="mt-auto text-xs text-muted-foreground">{props.footer}</div>
      </Show>
    </li>
  )
}
