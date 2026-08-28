import { For } from "solid-js"

/**
 * Dense presentation of exact redirect URIs. In a table cell each URI stays on one truncated
 * monospace line with the full value in its tooltip, so a client with many long callbacks never
 * makes a row ragged. In the stacked mobile record there is no column to keep even, so `wrap` shows
 * the exact string in full instead of clipping it on a narrow viewport.
 */
export function OidcAdminUriList(props: { readonly uris: readonly string[]; readonly wrap?: boolean }) {
  return (
    <ul class="grid min-w-0 gap-0.5">
      <For each={props.uris}>
        {(uri) => (
          <li
            class={`min-w-0 font-mono text-xs text-muted-foreground ${props.wrap ? "break-all" : "truncate"}`}
            title={uri}
          >
            {uri}
          </li>
        )}
      </For>
    </ul>
  )
}
