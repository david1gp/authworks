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
  // Display names and emails are resolved before pagination so a search matches the whole
  // realm, not only the sessions that happen to land on the current page.
  const users = userSessionDisplayList({
    database: options.database,
    realmId: options.realmId,
    userIds: views.flatMap((session) => (session.subjectType === "user" ? [session.subjectId] : [])),
  })
  if (!users.success) return users
  const usersById = new Map(users.data.map((user) => [user.id, user]))
  const enriched = views.map((session) => {
    const user = session.subjectType === "user" ? usersById.get(session.subjectId) : undefined
    return {
      session: { ...session, subjectDisplayName: user?.displayName ?? null, subjectEmail: user?.email ?? null },
      userName: user?.userName,
    }
  })
  const search = options.query?.search?.trim()
  const rows =
    search !== undefined && search.length > 0
      ? enriched
          .filter(({ session, userName }) => sessionRecordMatchesSearch(session, userName, search))
          .map(({ session }) => session)
      : enriched.map(({ session }) => session)
  const page = listRowsPage({
    idGet: (session) => session.id,
    query: options.query ?? (options.limit === undefined ? undefined : { pageSize: options.limit }),
    rows,
    sortDirection: "desc",
    sortValueGet: (session) => session.lastUsedAt,
  })
  if (!page.success) return page
  return resultCreate({ ...page.data, items: page.data.items })
}

function sessionRecordMatchesSearch(
  session: SessionListResponse["items"][number],
  userName: string | undefined,
  search: string,
): boolean {
  const needle = search.toLowerCase()
  return (
    [
      session.id,
      userName,
      session.subjectDisplayName,
      session.subjectEmail,
      session.subjectId,
      session.device.ipAddress,
      session.device.region,
      session.device.countryCode,
    ].some((value) => value?.toLowerCase().includes(needle)) === true
  )
}
