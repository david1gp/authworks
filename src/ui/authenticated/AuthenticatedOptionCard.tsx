import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedOptionCardStateCreate } from "./authenticatedOptionCardStateCreate.js"

/**
 * Selectable card for role and option choosers: radio/checkbox semantics with a visible selected
 * ring, optional bullet list, disabled state, and an `onSelect` callback.
 */
export function AuthenticatedOptionCard(props: {
  readonly bullets?: readonly string[]
  readonly checkedRole?: "radio" | "checkbox"
  readonly class?: string
  readonly description?: string
  readonly disabled?: boolean
  readonly icon?: string
  readonly onSelect?: () => void
  readonly selected?: boolean
  readonly title: string
}) {
  const state = authenticatedOptionCardStateCreate({
    disabled: () => props.disabled ?? false,
    onSelect: props.onSelect,
  })
  return (
    // Keyboard handling is wired explicitly: the card toggles on Enter/Space like a native radio.
    // biome-ignore lint/a11y/noStaticElementInteractions: selectable card with explicit keyboard support
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-checked rides the explicit radio/checkbox role
    <div
      aria-checked={props.selected ?? false}
      aria-disabled={props.disabled}
      aria-label={props.title}
      class={classMerge(
        "grid w-full gap-1.5 rounded-panel border p-4 text-start transition-colors",
        props.selected
          ? "border-accent/50 bg-accent-soft/60 shadow-panel"
          : "border-line bg-surface shadow-panel hover:border-line-strong",
        props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        props.class,
      )}
      onClick={state.select}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          state.select()
        }
      }}
      role={props.checkedRole ?? "radio"}
      tabIndex={props.disabled ? -1 : 0}
    >
      <span class="flex items-center gap-2">
        <Show when={props.icon}>
          {(icon) => <Icon aria-hidden="true" class="size-4.5 text-accent" path={icon()} />}
        </Show>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{props.title}</span>
        <Show when={props.selected}>
          <span class="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
            <Icon aria-hidden="true" class="size-3.5" path={mdiCheck} />
          </span>
        </Show>
      </span>
      <Show when={props.description}>
        {(description) => <span class="text-[0.8125rem] leading-5 text-muted-foreground">{description()}</span>}
      </Show>
      <Show when={(props.bullets?.length ?? 0) > 0}>
        <ul class="grid gap-1 text-[0.8125rem] leading-5 text-muted-foreground">
          <For each={props.bullets ?? []}>
            {(bullet) => (
              <li class="flex items-start gap-1.5">
                <span aria-hidden="true" class="mt-[0.55rem] size-1 shrink-0 rounded-full bg-current" />
                <span>{bullet}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
