import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedThemeToggleStateCreate } from "./authenticatedThemeToggleStateCreate.js"

export function AuthenticatedThemeToggle(props: { readonly class?: string }) {
  const state = authenticatedThemeToggleStateCreate()
  return (
    <fieldset
      class={classMerge(
        "inline-flex h-8 shrink-0 items-center rounded-full border border-line bg-surface p-0.5",
        props.class,
      )}
    >
      <For each={state.options}>
        {(option) => (
          <button
            aria-label={option.label()}
            aria-pressed={option.pressed()}
            title={option.label()}
            class={classMerge(
              "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
              option.pressed()
                ? "bg-accent text-accent-contrast"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
            type="button"
            onClick={option.select}
          >
            <Icon path={option.icon} class="size-4" />
          </button>
        )}
      </For>
    </fieldset>
  )
}
