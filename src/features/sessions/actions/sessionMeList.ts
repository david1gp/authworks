import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionMePublicViewCreate } from "../domain/sessionMePublicViewCreate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionMeListResponse } from "../public/sessionMeListResponseSchema.js"

type SessionMeListOptions = {
  readonly currentSessionId: string
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly userId: string
}

export function sessionMeList(options: SessionMeListOptions): Result<SessionMeListResponse> {
  const op = "sessionMeList"
  if (options.realmId.length === 0 || options.userId.length === 0 || options.currentSessionId.length === 0)
    return resultErrorCreate(op, "The session ownership is invalid.", "sessions.invalid")
  const sessions = sessionRepositoryCreate(options.database.db).sessionList(
    options.realmId,
    options.userId,
    undefined,
    "user",
  )
  if (!sessions.success) return sessions
  const views = sessions.data.map((session) =>
    sessionMePublicViewCreate(session, session.id === options.currentSessionId),
  )
  return listRowsPage({
    idGet: (session) => session.id,
    query: options.query,
    rows: views,
    sortDirection: "desc",
    sortValueGet: (session) => session.lastUsedAt,
  })
}
