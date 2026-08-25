import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userAccountSummaryResolve } from "../../users/server/userAccountSummaryResolve.js"
import type { SessionRecentListResponse } from "../public/sessionRecentListResponseSchema.js"
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

export function sessionRecentList(options: SessionRecentListOptions): Result<SessionRecentListResponse> {
  const recent = sessionList({
    ...options,
    query: { ...options.query, pageSize: Math.min(options.query?.pageSize ?? 5, 5) },
  })
  if (!recent.success) return recent
  const items: SessionRecentListResponse["items"] = []
  for (const session of recent.data.items) {
    if (session.userId === undefined) {
      items.push(session)
      continue
    }
    const summary = userAccountSummaryResolve({
      database: options.database,
      realmId: options.realmId,
      userId: session.userId,
    })
    if (!summary.success) return summary
    items.push(summary.data === undefined ? session : { ...session, ...summary.data })
  }
  return { data: { ...recent.data, items }, success: true }
}
