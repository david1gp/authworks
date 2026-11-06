import type { JSX } from "solid-js"
import { For, Show } from "solid-js"

/** Detail page heading with optional navigation, actions, and facts. */
export function AuthenticatedDetailHeader(props: {
  readonly actions?: JSX.Element
  readonly backHref?: string
  readonly backLabel?: string
  readonly badges?: JSX.Element
  readonly facts?: readonly { readonly label: string; readonly value: JSX.Element }[]
  readonly leading?: JSX.Element
  readonly subtitle?: JSX.Element
  readonly title: JSX.Element
}) {
  return (
    <header class="grid gap-2">
      <Show when={props.backHref}>
        {(href) => (
          <a href={href()} class="w-fit text-xs text-muted-foreground hover:text-foreground">
            {props.backLabel ?? "Back"}
          </a>
        )}
      </Show>
      <div class="rounded-panel border border-line bg-surface p-5 shadow-panel sm:px-6 compact:px-4 compact:py-3">
        <div class="flex flex-wrap items-start gap-4">
          <Show when={props.leading}>
            <div class="shrink-0">{props.leading}</div>
          </Show>
          <div class="grid min-w-0 flex-[1_1_12rem] gap-1">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <h1 class="min-w-0 break-words text-lg font-semibold tracking-tight">{props.title}</h1>
              {props.badges}
            </div>
            <Show when={props.subtitle}>
              <div class="min-w-0 text-sm text-muted-foreground">{props.subtitle}</div>
            </Show>
          </div>
          <Show when={props.actions}>
            <div class="flex max-w-full flex-wrap items-center gap-2">{props.actions}</div>
          </Show>
        </div>
        <Show when={(props.facts?.length ?? 0) > 0}>
          <dl class="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line-subtle pt-4 compact:mt-3 compact:pt-3">
            <For each={props.facts}>
              {(fact) => (
                <div class="min-w-0">
                  <dt class="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd class="min-w-0 break-words text-[13px]">{fact.value}</dd>
                </div>
              )}
            </For>
          </dl>
        </Show>
      </div>
    </header>
  )
}
