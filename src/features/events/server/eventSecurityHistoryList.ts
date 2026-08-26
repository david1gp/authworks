import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityHistoryProjectionCreate } from "../domain/eventSecurityHistoryProjectionCreate.js"
import type { EventSecurityHistoryListResponse } from "../public/eventSecurityHistoryListResponseSchema.js"
import { eventUserSecurityHistoryList } from "./eventUserSecurityHistoryList.js"

type EventSecurityHistoryListOptions = {
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly userId: string
}

export function eventSecurityHistoryList(
  options: EventSecurityHistoryListOptions,
): Result<EventSecurityHistoryListResponse> {
  const history = eventUserSecurityHistoryList(options)
  if (!history.success) return history
  const items = []
  for (const item of history.data.items) {
    const projected = eventSecurityHistoryProjectionCreate(item)
    if (!projected.success) return projected
    items.push(projected.data)
  }
  return {
    data: {
      items,
      ...(history.data.nextPageToken === undefined ? {} : { nextPageToken: history.data.nextPageToken }),
    },
    success: true,
  }
}
