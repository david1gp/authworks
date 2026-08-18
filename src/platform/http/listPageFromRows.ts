import { listCursorEncode } from "./listCursorEncode.js"

export function listPageFromRows<T>(input: {
  readonly rows: readonly T[]
  readonly pageSize: number
  readonly idGet: (row: T) => string
  readonly sortValueGet: (row: T) => string | number
}): { items: T[]; nextPageToken?: string } {
  if (input.rows.length <= input.pageSize) return { items: [...input.rows] }

  const items = input.rows.slice(0, input.pageSize)
  const lastItem = items.at(-1)
  if (lastItem === undefined) return { items }

  return {
    items,
    nextPageToken: listCursorEncode({ id: input.idGet(lastItem), k: input.sortValueGet(lastItem) }),
  }
}
