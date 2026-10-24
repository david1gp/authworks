import { mdiAlertCircle } from "@adaptive-ds/mdi/mdiAlertCircle.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"

/**
 * Account card icon. A bare large subject icon with an optional status badge overlapping its bottom-right corner.
 * The badge cut-out follows the card summary hover background through the `group/summary` named group.
 */
export function AccountCardIcon(props: {
  readonly path: string
  readonly tone?: "accent" | "danger"
  readonly badge?: "success" | "danger"
}) {
  return (
    <span
      aria-hidden="true"
      class="relative inline-flex shrink-0"
      classList={{
        "text-accent": (props.tone ?? "accent") === "accent",
        "text-danger": props.tone === "danger",
      }}
    >
      <Icon aria-hidden="true" class="size-8 sm:size-9" path={props.path} />
      <Show when={props.badge}>
        {(badge) => (
          <span
            aria-hidden="true"
            class="absolute -right-1 -bottom-1 inline-flex rounded-full bg-surface ring-2 ring-surface group-hover/summary:bg-surface-hover group-hover/summary:ring-surface-hover"
          >
            <Show
              when={badge() === "success"}
              fallback={<Icon aria-hidden="true" class="size-4.5 text-danger" path={mdiAlertCircle} />}
            >
              <Icon aria-hidden="true" class="size-4.5 text-success" path={mdiCheckCircle} />
            </Show>
          </span>
        )}
      </Show>
    </span>
  )
}
