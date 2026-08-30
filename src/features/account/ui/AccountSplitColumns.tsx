import type { JSX } from "solid-js"

/**
 * Two-column account layout: the wider `primary` column carries what already exists on the account
 * (entries, sessions), the narrower `secondary` column carries the matching add/enroll/link controls
 * or the related collection. Below `lg` the columns stack with `primary` first.
 */
export function AccountSplitColumns(props: { readonly primary: JSX.Element; readonly secondary: JSX.Element }) {
  return (
    <div class="grid min-w-0 items-start gap-3 lg:grid-cols-12 [&>*]:min-w-0">
      <div class="grid min-w-0 gap-3 lg:col-span-7 [&>*]:min-w-0">{props.primary}</div>
      <div class="grid min-w-0 gap-3 lg:col-span-5 [&>*]:min-w-0">{props.secondary}</div>
    </div>
  )
}
