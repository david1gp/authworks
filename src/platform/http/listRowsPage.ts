import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { listCursorDecode } from "./listCursorDecode.js"
import { listPageFromRows } from "./listPageFromRows.js"
import { listPageSizeResolve } from "./listPageSizeResolve.js"
import type { ListQuery } from "./listQuerySchema.js"

export function listRowsPage<T>(input: {
  readonly rows: readonly T[]
  readonly query?: ListQuery
  readonly idGet: (row: T) => string
  readonly sortValueGet: (row: T) => string | number | null | undefined
  readonly sortDirection?: "asc" | "desc"
  readonly nullsLast?: boolean
}): Result<{ items: T[]; nextPageToken?: string }> {
  const pageSize = listPageSizeResolve(input.query?.pageSize)
  const direction = input.sortDirection ?? input.query?.sortDirection ?? "asc"
  const nullsLast = input.nullsLast ?? false
  let rows = [...input.rows].sort((left, right) =>
    listRowsCompare(
      input.sortValueGet(left),
      input.sortValueGet(right),
      input.idGet(left),
      input.idGet(right),
      direction,
      nullsLast,
    ),
  )
  if (input.query?.pageToken !== undefined) {
    const cursor = listCursorDecode(input.query.pageToken)
    if (!cursor.success) return cursor
    rows = rows.filter((row) =>
      listRowIsAfterCursor(input.idGet(row), input.sortValueGet(row), cursor.data, direction, nullsLast),
    )
  }
  return resultCreate(
    listPageFromRows({
      idGet: input.idGet,
      pageSize,
      rows,
      sortValueGet: input.sortValueGet,
    }),
  )
}

function listRowIsAfterCursor(
  id: string,
  sortValue: string | number | null | undefined,
  cursor: { id: string; k: string | number | null },
  direction: "asc" | "desc",
  nullsLast: boolean,
): boolean {
  const { compared } = listSortValueCompare(sortValue ?? null, cursor.k, nullsLast)
  if (compared === 0) return direction === "desc" ? id < cursor.id : id > cursor.id
  // Nulls sort last in both directions, so after a null cursor every row is behind us.
  if (cursor.k === null) return false
  if (sortValue === null || sortValue === undefined) return true
  return direction === "desc" ? compared < 0 : compared > 0
}

function listRowsCompare(
  leftSortValue: string | number | null | undefined,
  rightSortValue: string | number | null | undefined,
  leftId: string,
  rightId: string,
  direction: "asc" | "desc",
  nullsLast: boolean,
): number {
  const { compared, nullRank } = listSortValueCompare(leftSortValue ?? null, rightSortValue ?? null, nullsLast)
  if (compared !== 0) {
    // Nulls always sort last regardless of direction; only non-null values flip.
    if (nullRank !== 0) return compared
    return direction === "desc" ? -compared : compared
  }
  if (leftId === rightId) return 0
  const idCompared = leftId.localeCompare(rightId)
  return direction === "desc" ? -idCompared : idCompared
}

function listSortValueCompare(
  left: string | number | null,
  right: string | number | null,
  nullsLast = false,
): { compared: number; nullRank: number } {
  if (left === null && right === null) return { compared: 0, nullRank: 0 }
  if (left === null) return { compared: nullsLast ? 1 : -1, nullRank: 1 }
  if (right === null) return { compared: nullsLast ? -1 : 1, nullRank: -1 }
  if (typeof left === "number" && typeof right === "number") return { compared: left - right, nullRank: 0 }
  return { compared: String(left).localeCompare(String(right)), nullRank: 0 }
}
