import { For, Show } from "solid-js"

/** Dense inline chips for membership roles, scopes, and transports on the account pages. */
export function AccountRoleList(props: { readonly empty?: string; readonly values: readonly string[] }) {
  return (
    <Show
      when={props.values.length > 0}
      fallback={<span class="text-xs text-muted-foreground">{props.empty ?? ""}</span>}
    >
      <span class="flex min-w-0 flex-wrap gap-1">
        <For each={props.values}>
          {(value) => (
            <span class="max-w-full truncate rounded-control border border-line bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {value}
            </span>
          )}
        </For>
      </span>
    </Show>
  )
}
