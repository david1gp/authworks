import type { JSX } from "solid-js"

/**
 * Narrow-viewport counterpart to the dense authenticated table. Rows become stacked records so every
 * column and action stays reachable without horizontal scrolling; the table takes over from `md` up.
 */
export function AuthenticatedRecordList(props: { readonly children: JSX.Element; readonly label: string }) {
  return (
    <ul aria-label={props.label} class="divide-y divide-line-subtle md:hidden">
      {props.children}
    </ul>
  )
}
