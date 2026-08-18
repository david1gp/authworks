import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionList } from "./sessionList.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"

type SessionRecentListOptions = {
  readonly currentSessionId?: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

export function sessionRecentList(options: SessionRecentListOptions): Result<SessionListResponse> {
  return sessionList({ ...options, limit: 5 })
}
