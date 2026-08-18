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
  readonly sortValueGet: (row: T) => string | number
  readonly sortDirection?: "asc" | "desc"
}): Result<{ items: T[]; nextPageToken?: string }> {
  const pageSize = listPageSizeResolve(input.query?.pageSize)
  const direction = input.sortDirection ?? input.query?.sortDirection ?? "asc"
  let rows = [...input.rows].sort((left, right) =>
    listRowsCompare(
      input.sortValueGet(left),
      input.sortValueGet(right),
      input.idGet(left),
      input.idGet(right),
      direction,
    ),
  )
  if (input.query?.pageToken !== undefined) {
    const cursor = listCursorDecode(input.query.pageToken)
    if (!cursor.success) return cursor
    rows = rows.filter((row) => listRowIsAfterCursor(input.idGet(row), input.sortValueGet(row), cursor.data, direction))
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
  sortValue: string | number,
  cursor: { id: string; k: string | number },
  direction: "asc" | "desc",
): boolean {
  const compared = listSortValueCompare(sortValue, cursor.k)
  if (compared === 0) return direction === "desc" ? id < cursor.id : id > cursor.id
  return direction === "desc" ? compared < 0 : compared > 0
}

function listRowsCompare(
  leftSortValue: string | number,
  rightSortValue: string | number,
  leftId: string,
  rightId: string,
  direction: "asc" | "desc",
): number {
  const compared = listSortValueCompare(leftSortValue, rightSortValue)
  if (compared !== 0) return direction === "desc" ? -compared : compared
  if (leftId === rightId) return 0
  const idCompared = leftId.localeCompare(rightId)
  return direction === "desc" ? -idCompared : idCompared
}

function listSortValueCompare(left: string | number, right: string | number): number {
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right))
}
