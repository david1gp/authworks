import type { JSX } from "solid-js"
import { For, Show } from "solid-js"
import { AuthenticatedFieldList } from "./AuthenticatedFieldList.js"
import type { AuthenticatedField } from "./authenticatedField.js"

/** One stacked record inside {@link AuthenticatedRecordList}: title, status badges, fields, actions. */
export function AuthenticatedRecordItem(props: {
  readonly actions?: JSX.Element
  readonly children?: JSX.Element
  readonly compact?: boolean
  readonly fields?: readonly AuthenticatedField[]
  readonly meta?: readonly JSX.Element[]
  readonly status?: JSX.Element
  readonly title: JSX.Element
}) {
  return (
    <li class="grid min-w-0 gap-2 px-5 py-3.5">
      <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div class="min-w-0 flex-1 truncate text-sm font-medium">{props.title}</div>
        <Show when={props.status}>{(status) => <div class="flex flex-wrap items-center gap-1.5">{status()}</div>}</Show>
      </div>
      <Show when={props.compact} fallback={<AuthenticatedFieldList fields={props.fields ?? []} />}>
        <Show when={(props.meta?.length ?? 0) > 0}>
          <div class="truncate text-xs text-muted-foreground">
            <For each={props.meta}>
              {(item, index) => (
                <>
                  {index() > 0 && " · "}
                  {item}
                </>
              )}
            </For>
          </div>
        </Show>
      </Show>
      {props.children}
      <Show when={props.actions}>
        {(actions) => <div class="flex flex-wrap items-center gap-1.5">{actions()}</div>}
      </Show>
    </li>
  )
}
