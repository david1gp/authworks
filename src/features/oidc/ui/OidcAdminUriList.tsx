import { For } from "solid-js"

/**
 * Dense presentation of exact redirect URIs. Each URI stays on one truncated monospace line with the
 * full value in its tooltip, so a client with many long callbacks never makes a row ragged or
 * overflow, while the exact string remains inspectable.
 */
export function OidcAdminUriList(props: { readonly uris: readonly string[] }) {
  return (
    <ul class="grid min-w-0 gap-0.5">
      <For each={props.uris}>
        {(uri) => (
          <li class="min-w-0 truncate font-mono text-xs text-muted-foreground" title={uri}>
            {uri}
          </li>
        )}
      </For>
    </ul>
  )
}
