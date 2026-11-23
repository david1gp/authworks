import { type JSX } from "@solidjs/web"

export function AccountWorkspaceAccess(props: { readonly children: JSX.Element }) {
  return <div class="grid min-w-0 gap-3 [&>*]:min-w-0">{props.children}</div>
}
