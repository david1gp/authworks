import type { AuthenticatedDataTableSort } from "./authenticatedDataTableSort.js"

export function authenticatedDataTableStateCreate(options: {
  readonly activeSort: () => AuthenticatedDataTableSort | undefined
  readonly loading: () => boolean
  readonly onSortChange?: (sort: AuthenticatedDataTableSort) => void
  readonly rows: () => readonly unknown[]
}) {
  return {
    rows: options.rows,
    showEmpty: () => !options.loading() && options.rows().length === 0,
    sortToggle: (sortKey: string) => () => {
      const current = options.activeSort()
      options.onSortChange?.(
        current?.key === sortKey && current.direction === "asc"
          ? { direction: "desc", key: sortKey }
          : { direction: "asc", key: sortKey },
      )
    },
  }
}
