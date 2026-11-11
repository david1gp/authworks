import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { AuthenticatedCopyButton } from "./AuthenticatedCopyButton.js"

export function AuthenticatedCopyField(props: {
  readonly adornment?: JSX.Element
  readonly class?: string
  readonly copyLabel: string
  readonly fallback?: JSX.Element
  readonly icon?: string
  readonly identifier?: boolean
  readonly label?: string
  readonly value: string | undefined
}) {
  return (
    <div class={classMerge("relative z-10 inline-flex min-w-0 items-center gap-1 text-xs", props.class)}>
      <Show when={props.icon}>
        {(icon) => <Icon aria-hidden="true" class="size-3.5 shrink-0 text-muted-foreground" path={icon()} />}
      </Show>
      <Show when={props.label}>
        <span class="shrink-0 text-muted-foreground">{props.label}</span>
      </Show>
      <Show when={props.value} fallback={props.fallback ?? <span class="text-muted-foreground">—</span>}>
        {(value) => (
          <>
            <span
              class={classMerge("min-w-0 [overflow-wrap:anywhere]", props.identifier && "font-mono")}
              title={value()}
            >
              {props.identifier && value().length > 18 ? `${value().slice(0, 8)}…${value().slice(-4)}` : value()}
            </span>
            {props.adornment}
            <AuthenticatedCopyButton class="shrink-0" label={props.copyLabel} value={value()} />
          </>
        )}
      </Show>
    </div>
  )
}
