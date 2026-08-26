import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listPageSizeResolve } from "../../../platform/http/listPageSizeResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityHistoryCursorDecode } from "../domain/eventSecurityHistoryCursorDecode.js"
import { eventSecurityHistoryCursorEncode } from "../domain/eventSecurityHistoryCursorEncode.js"
import { eventRepositoryCreate } from "../persistence/eventRepositoryCreate.js"

type EventUserSecurityHistoryListOptions = {
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly userId: string
}

export function eventUserSecurityHistoryList(options: EventUserSecurityHistoryListOptions) {
  const op = "eventUserSecurityHistoryList"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The security history subject is invalid.", "events.invalid")
  if (options.query?.sortBy !== undefined || options.query?.sortDirection !== undefined)
    return resultErrorCreate(op, "Security history is ordered by newest event position.", "events.invalid")
  const positionBefore =
    options.query?.pageToken !== undefined
      ? eventSecurityHistoryCursorDecode(options.query.pageToken)
      : resultCreate<number | undefined>(undefined)
  if (!positionBefore.success) return positionBefore
  const pageSize = listPageSizeResolve(options.query?.pageSize)
  const rows = eventRepositoryCreate(options.database.db).eventUserSecurityHistoryList(
    options.realmId,
    options.userId,
    positionBefore.data,
    pageSize + 1,
  )
  if (!rows.success) return rows
  const items = rows.data.slice(0, pageSize)
  const last = items.at(-1)
  const safeItems = items.map(({ position: _position, ...item }) => item)
  return resultCreate({
    items: safeItems,
    ...(rows.data.length > pageSize && last !== undefined
      ? { nextPageToken: eventSecurityHistoryCursorEncode(last.position) }
      : {}),
  })
}
