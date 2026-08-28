import { For } from "solid-js"

/** Granted scopes as compact monospace chips, so a long scope set wraps instead of widening a row. */
export function OidcAdminScopeList(props: { readonly scopes: readonly string[] }) {
  return (
    <span class="flex min-w-0 flex-wrap gap-1">
      <For each={props.scopes}>
        {(scope) => (
          <code class="rounded-control border border-line-subtle bg-muted px-1.5 py-0.5 font-mono text-2xs leading-4 text-muted-foreground">
            {scope}
          </code>
        )}
      </For>
    </span>
  )
}
