import type { JSX } from "solid-js"
import { Show } from "solid-js"

/** Compact authenticated page heading with optional eyebrow, description, metadata strip, and actions. */
export function AuthenticatedPageHeader(props: {
  readonly actions?: JSX.Element
  readonly description?: string
  readonly eyebrow?: string
  readonly meta?: JSX.Element
  readonly title: string
}) {
  return (
    <header class="grid gap-2 border-b border-line pb-3">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div class="min-w-0 grid gap-1">
          <Show when={props.eyebrow}>
            {(eyebrow) => (
              <p class="truncate text-2xs font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                {eyebrow()}
              </p>
            )}
          </Show>
          <h1 class="truncate text-lg font-semibold tracking-tight">{props.title}</h1>
          <Show when={props.description}>
            {(description) => <p class="max-w-3xl text-sm text-muted-foreground">{description()}</p>}
          </Show>
        </div>
        <Show when={props.actions}>
          {(actions) => <div class="flex flex-wrap items-center gap-2">{actions()}</div>}
        </Show>
      </div>
      <Show when={props.meta}>
        {(meta) => (
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">{meta()}</div>
        )}
      </Show>
    </header>
  )
}
