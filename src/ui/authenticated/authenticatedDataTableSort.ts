/** Ascending/descending sort applied to a single sortable data-table column. */
export type AuthenticatedDataTableSort = {
  readonly direction: "asc" | "desc"
  readonly key: string
}
