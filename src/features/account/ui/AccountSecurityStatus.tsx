import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"

export function AccountSecurityStatus(props: {
  readonly action?: JSX.Element
  readonly configured: boolean
  readonly detail: string
  readonly label: string
}) {
  return (
    <div
      class={
        props.configured
          ? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 bg-success/5 px-3 py-2.5"
          : "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 bg-danger/5 px-3 py-2.5"
      }
      data-configured={props.configured}
    >
      <Icon
        aria-hidden="true"
        class={props.configured ? "size-7 shrink-0 text-success" : "size-7 shrink-0 text-danger"}
        path={props.configured ? mdiCheckCircleOutline : mdiAlertCircleOutline}
      />
      <dl class="min-w-0">
        <dt class="text-xs font-semibold text-muted-foreground">{props.label}</dt>
        <dd class="truncate text-sm font-medium" title={props.detail}>
          {props.detail}
        </dd>
      </dl>
      <Show when={props.action}>{(action) => <div class="shrink-0">{action()}</div>}</Show>
    </div>
  )
}
