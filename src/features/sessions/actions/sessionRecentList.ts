import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"
import type { SessionSubjectType } from "../public/sessionSubjectTypeSchema.js"
import { sessionList } from "./sessionList.js"

type SessionRecentListOptions = {
  readonly currentSessionId?: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
  readonly subjectType?: SessionSubjectType
  readonly userId: string
}

export function sessionRecentList(options: SessionRecentListOptions): Result<SessionListResponse> {
  return sessionList({
    ...options,
    query: { ...options.query, pageSize: Math.min(options.query?.pageSize ?? 5, 5) },
  })
}
