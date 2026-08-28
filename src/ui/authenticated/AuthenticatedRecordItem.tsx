import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { AuthenticatedFieldList } from "./AuthenticatedFieldList.js"
import type { AuthenticatedField } from "./authenticatedField.js"

/** One stacked record inside {@link AuthenticatedRecordList}: title, status badges, fields, actions. */
export function AuthenticatedRecordItem(props: {
  readonly actions?: JSX.Element
  readonly children?: JSX.Element
  readonly fields: readonly AuthenticatedField[]
  readonly status?: JSX.Element
  readonly title: JSX.Element
}) {
  return (
    <li class="grid min-w-0 gap-2 px-3 py-2.5">
      <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div class="min-w-0 flex-1 truncate text-sm font-medium">{props.title}</div>
        <Show when={props.status}>{(status) => <div class="flex flex-wrap items-center gap-1.5">{status()}</div>}</Show>
      </div>
      <AuthenticatedFieldList fields={props.fields} />
      {props.children}
      <Show when={props.actions}>
        {(actions) => <div class="flex flex-wrap items-center gap-1.5">{actions()}</div>}
      </Show>
    </li>
  )
}
