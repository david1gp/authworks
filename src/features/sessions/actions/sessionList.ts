import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userSessionDisplayList } from "../../users/server/userSessionDisplayList.js"
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
} & ({ readonly userId: string; readonly realmWide?: never } | { readonly realmWide: true; readonly userId?: never })

export function sessionList(options: SessionListOptions): Result<SessionListResponse> {
  const op = "sessionList"
  if (
    options.realmId.length === 0 ||
    options.userId === "" ||
    (options.userId === undefined && options.realmWide !== true)
  )
    return resultErrorCreate(op, "The session ownership is invalid.", "sessions.invalid")
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1))
    return resultErrorCreate(op, "The session limit is invalid.", "sessions.invalid")
  const repository = sessionRepositoryCreate(options.database.db)
  const sessions =
    options.userId === undefined
      ? repository.sessionRealmList(options.realmId)
      : repository.sessionList(options.realmId, options.userId, undefined, options.subjectType)
  if (!sessions.success) return sessions
  const views = sessions.data.map((session) =>
    sessionPublicViewCreate(session, session.id === options.currentSessionId),
  )
  const page = listRowsPage({
    idGet: (session) => session.id,
    query: options.query ?? (options.limit === undefined ? undefined : { pageSize: options.limit }),
    rows: views,
    sortDirection: "desc",
    sortValueGet: (session) => session.lastUsedAt,
  })
  if (!page.success) return page
  const users = userSessionDisplayList({
    database: options.database,
    realmId: options.realmId,
    userIds: page.data.items.flatMap((session) => (session.subjectType === "user" ? [session.subjectId] : [])),
  })
  if (!users.success) return users
  const usersById = new Map(users.data.map((user) => [user.id, user]))
  return resultCreate({
    ...page.data,
    items: page.data.items.map((session) => {
      const user = session.subjectType === "user" ? usersById.get(session.subjectId) : undefined
      return { ...session, subjectDisplayName: user?.displayName ?? null, subjectEmail: user?.email ?? null }
    }),
  })
}
