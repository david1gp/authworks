import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import type { AuthenticatedTabItem } from "./authenticatedTabItem.js"

/**
 * Underline tab list whose selection follows the `active` value; every tab is a router link to
 * its own URL. Horizontal scroll on narrow viewports.
 */
export function AuthenticatedTabs(props: {
  readonly active: string
  readonly class?: string
  readonly items: readonly AuthenticatedTabItem[]
  readonly label: string
}) {
  return (
    <div
      aria-label={props.label}
      class={classMerge("-mb-px flex gap-1 overflow-x-auto border-b border-line", props.class)}
      role="tablist"
    >
      <For each={props.items}>
        {(item) => (
          <A
            aria-current={item.value === props.active ? "page" : undefined}
            aria-selected={item.value === props.active}
            class={classMerge(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              item.value === props.active
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:border-line-strong hover:text-foreground",
            )}
            href={item.href}
            role="tab"
          >
            <Show when={item.icon}>{(icon) => <Icon aria-hidden="true" class="size-4" path={icon()} />}</Show>
            <span>{item.label}</span>
            <Show when={item.count !== undefined}>
              {(count) => (
                <span
                  class={classMerge(
                    "rounded-full px-1.5 py-px text-xs tabular-nums",
                    item.value === props.active ? "bg-accent-soft" : "bg-muted",
                  )}
                >
                  {count()}
                </span>
              )}
            </Show>
          </A>
        )}
      </For>
    </div>
  )
}
