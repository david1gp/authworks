import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedSubNavItem } from "./authenticatedSubNavItem.js"

/**
 * Section navigation for settings screens: vertical link rows on desktop, collapsing to a
 * horizontal scroll row on mobile.
 */
export function AuthenticatedSubNav(props: {
  readonly active: string
  readonly class?: string
  readonly items: readonly AuthenticatedSubNavItem[]
  readonly label: string
}) {
  return (
    <nav aria-label={props.label} class={classMerge("min-w-0", props.class)}>
      <div class="flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
        <For each={props.items}>
          {(item) => (
            <A
              aria-current={item.value === props.active ? "page" : undefined}
              class={classMerge(
                "flex min-w-0 shrink-0 items-center gap-2.5 rounded-control border px-3 py-2.5 text-start transition-colors lg:w-full",
                item.value === props.active
                  ? "border-accent/35 bg-accent-soft text-accent"
                  : "border-transparent text-foreground/80 hover:border-line hover:bg-surface-hover hover:text-foreground",
              )}
              href={item.href}
            >
              <Show when={item.icon}>
                {(icon) => (
                  <span
                    class={classMerge(
                      "grid size-8 shrink-0 place-items-center rounded-control",
                      item.value === props.active ? "bg-accent/15" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" class="size-4" path={icon()} />
                  </span>
                )}
              </Show>
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{item.label}</span>
                <Show when={item.description}>
                  {(description) => (
                    <span class="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block lg:whitespace-normal">
                      {description()}
                    </span>
                  )}
                </Show>
              </span>
            </A>
          )}
        </For>
      </div>
    </nav>
  )
}
