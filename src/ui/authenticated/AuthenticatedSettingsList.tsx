import type { JSX } from "solid-js"

/** Groups settings rows with dividers. */
export function AuthenticatedSettingsList(props: { readonly children: JSX.Element }) {
  return <div class="divide-y divide-line-subtle">{props.children}</div>
}
