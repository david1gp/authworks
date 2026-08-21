import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"
import type { SessionSubjectType } from "../public/sessionSubjectTypeSchema.js"

type SessionListOptions = {
  readonly currentSessionId?: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
  readonly limit?: number
  readonly subjectType?: SessionSubjectType
  readonly userId: string
}

export function sessionList(options: SessionListOptions): Result<SessionListResponse> {
  const op = "sessionList"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The session ownership is invalid.", "sessions.invalid")
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1))
    return resultErrorCreate(op, "The session limit is invalid.", "sessions.invalid")
  const sessions = sessionRepositoryCreate(options.database.db).sessionList(
    options.realmId,
    options.userId,
    undefined,
    options.subjectType,
  )
  if (!sessions.success) return sessions
  const views = sessions.data.map((session) =>
    sessionPublicViewCreate(session, session.id === options.currentSessionId),
  )
  return listRowsPage({
    idGet: (session) => session.id,
    query: options.query ?? (options.limit === undefined ? undefined : { pageSize: options.limit }),
    rows: views,
    sortDirection: "desc",
    sortValueGet: (session) => session.lastUsedAt,
  })
}
