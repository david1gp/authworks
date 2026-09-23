import type { JSX } from "solid-js"

export function AccountWorkspaceAccess(props: { readonly children: JSX.Element }) {
  return <div class="grid min-w-0 gap-5 [&>*]:min-w-0">{props.children}</div>
}
