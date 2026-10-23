import type { JSX } from "solid-js"

/** One column of the generic authenticated data table. */
export type AuthenticatedDataTableColumn<T> = {
  /** Stable identifier used for sort state and test hooks. */
  readonly key: string
  readonly header: string
  /** Renders the row's cell content; keep it to text, links, or chips for density. */
  readonly cell: (row: T) => JSX.Element
  readonly class?: string
  /** Enables the sortable header button for this column. */
  readonly sortKey?: string
  readonly align?: "start" | "end"
}
