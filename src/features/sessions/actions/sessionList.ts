import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"

type SessionListOptions = {
  readonly currentSessionId?: string
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly limit?: number
  readonly userId: string
}

export function sessionList(options: SessionListOptions): Result<SessionListResponse> {
  const op = "sessionList"
  if (options.instanceId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The session ownership is invalid.")
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1))
    return resultErrorCreate(op, "The session limit is invalid.")
  const sessions = sessionRepositoryCreate(options.database.db).sessionList(
    options.instanceId,
    options.userId,
    options.limit,
  )
  if (!sessions.success) return sessions
  return resultCreate({
    sessions: sessions.data.map((session) => sessionPublicViewCreate(session, session.id === options.currentSessionId)),
    total: sessions.data.length,
  })
}
