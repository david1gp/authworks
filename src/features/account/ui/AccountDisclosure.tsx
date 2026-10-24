import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { AccountCardIcon } from "./AccountCardIcon.js"

/**
 * Collapsed-by-default account disclosure. The card variant keeps a subject's icon, current value,
 * and status visible while its explanations and actions stay inside the native details body.
 */
export function AccountDisclosure(
  props: {
    readonly children: JSX.Element
    readonly class?: string
    readonly open?: boolean
    readonly summary: string
  } & (
    | {
        readonly variant?: undefined
        readonly icon?: never
        readonly iconTone?: never
        readonly value?: never
        readonly status?: never
        readonly statusTone?: never
      }
    | {
        readonly variant: "card"
        readonly icon: string
        readonly iconTone?: "accent" | "danger"
        readonly value?: string
        readonly status?: string
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
      open={props.open}
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
          <summary class="group/summary grid min-h-20 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-panel px-4 py-3.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:px-5 sm:py-4">
            <AccountCardIcon
              badge={
                props.iconTone === "danger" || !props.statusTone || props.statusTone === "neutral"
                  ? undefined
                  : props.statusTone
              }
              path={icon()}
              tone={props.iconTone ?? "accent"}
            />
            <span class="grid min-w-0 gap-0.5">
              <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                <span class="min-w-0 break-words text-base font-semibold tracking-tight">{props.summary}</span>
                <Show when={props.status}>
                  {(status) => (
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium"
                      classList={{
                        "bg-success-soft text-success": props.statusTone === "success",
                        "bg-danger-soft text-danger": props.statusTone === "danger",
                        "bg-muted text-muted-foreground": !props.statusTone || props.statusTone === "neutral",
                      }}
                    >
                      {status()}
                    </span>
                  )}
                </Show>
              </span>
              <Show when={props.value}>
                {(value) => <span class="min-w-0 break-words text-sm text-muted-foreground">{value()}</span>}
              </Show>
            </span>
            <Icon
              aria-hidden="true"
              class="size-5 text-accent transition-transform group-open:rotate-180"
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
