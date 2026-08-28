/**
 * Dense presentation of exact scope tokens. Scopes are matched exactly, so they are shown as one
 * wrapping monospace value rather than truncated: a clipped scope would be indistinguishable from a
 * different scope. Wrapping keeps the full list legible on a phone without widening the row.
 */
export function MachineAdminScopeList(props: { readonly empty?: string; readonly scopes: readonly string[] }) {
  return (
    <span class="block min-w-0 break-all font-mono text-xs text-muted-foreground">
      {props.scopes.length === 0 ? (props.empty ?? "—") : props.scopes.join(", ")}
    </span>
  )
}
