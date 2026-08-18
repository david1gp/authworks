import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { sessionList } from "./sessionList.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"

type SessionRecentListOptions = {
  readonly currentSessionId?: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
  readonly userId: string
}

export function sessionRecentList(options: SessionRecentListOptions): Result<SessionListResponse> {
  return sessionList({
    ...options,
    query: { ...options.query, pageSize: Math.min(options.query?.pageSize ?? 5, 5) },
  })
}
