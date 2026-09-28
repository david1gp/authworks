import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Collapsed-by-default account disclosure. The card variant keeps a subject's icon, current value,
 * and status visible while its explanations and actions stay inside the native details body.
 */
export function AccountDisclosure(
  props: {
    readonly children: JSX.Element
    readonly class?: string
    readonly summary: string
  } & (
    | {
        readonly variant?: undefined
        readonly icon?: never
        readonly value?: never
        readonly status?: never
        readonly statusIcon?: never
        readonly statusTone?: never
      }
    | {
        readonly variant: "card"
        readonly icon: string
        readonly value?: string
        readonly status?: string
        readonly statusIcon?: string
        readonly statusTone?: "danger" | "neutral" | "success"
      }
  ),
) {
  return (
    <details
      class={classMerge(
        "group min-w-0 border",
        props.variant === "card" ? "rounded-panel border-line bg-surface" : "rounded-control border-line-subtle",
        props.class,
      )}
    >
      <Show
        when={props.variant === "card" ? props.icon : undefined}
        fallback={
          <summary class="cursor-pointer rounded-control px-2 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
            {props.summary}
          </summary>
        }
      >
        {(icon) => (
          <summary class="grid min-h-16 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-panel px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:px-5">
            <Icon aria-hidden="true" class="size-5 text-muted-foreground" path={icon()} />
            <span class="grid min-w-0 gap-0.5">
              <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                <span class="min-w-0 break-words text-sm font-semibold tracking-tight">{props.summary}</span>
                <Show when={props.status}>
                  {(status) => (
                    <span
                      class="text-xs font-medium"
                      classList={{
                        "inline-flex items-center gap-1": !!props.statusIcon,
                        "text-danger": props.statusTone === "danger",
                        "text-success": props.statusTone === "success",
                        "text-muted-foreground": !props.statusTone || props.statusTone === "neutral",
                      }}
                    >
                      <Show when={props.statusIcon}>
                        {(statusIcon) => <Icon aria-hidden="true" class="size-3.5 shrink-0" path={statusIcon()} />}
                      </Show>
                      {status()}
                    </span>
                  )}
                </Show>
              </span>
              <Show when={props.value}>
                {(value) => <span class="min-w-0 break-words text-xs text-muted-foreground">{value()}</span>}
              </Show>
            </span>
            <Icon
              aria-hidden="true"
              class="size-5 text-muted-foreground transition-transform group-open:rotate-180"
              path={mdiChevronDown}
            />
          </summary>
        )}
      </Show>
      <div
        class={
          props.variant === "card"
            ? "min-w-0 border-t border-line-subtle px-4 py-3 sm:px-5 sm:py-4"
            : "min-w-0 border-t border-line-subtle px-2 py-1.5"
        }
      >
        {props.children}
      </div>
    </details>
  )
}
