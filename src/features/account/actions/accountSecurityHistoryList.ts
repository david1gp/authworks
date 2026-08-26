import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { eventSecurityHistoryList } from "../../events/server/eventSecurityHistoryList.js"
import type { SessionSubjectType } from "../../sessions/public/sessionSubjectTypeSchema.js"
import type { AccountSecurityHistoryListResponse } from "../public/accountSecurityHistoryListResponseSchema.js"

type AccountSecurityHistoryListOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly subjectId: string
  readonly subjectType: SessionSubjectType
}

export function accountSecurityHistoryList(
  options: AccountSecurityHistoryListOptions,
): Result<AccountSecurityHistoryListResponse> {
  const op = "accountSecurityHistoryList"
  if (
    options.actor.kind !== "user" ||
    options.actor.realmId !== options.realmId ||
    options.actor.actorId.length === 0 ||
    options.realmId.length === 0 ||
    options.subjectId.length === 0 ||
    options.subjectType !== "user"
  )
    return resultErrorCodedCreate(op, "The authenticated account is not available in this realm.", "account.forbidden")

  const history = eventSecurityHistoryList({
    database: options.database,
    query: options.query,
    realmId: options.realmId,
    userId: options.subjectId,
  })
  if (!history.success)
    return resultErrorCodedCreate(
      op,
      history.errorMessage,
      history.code === "events.invalid" ? "account.invalid" : "account.read-failed",
    )
  return resultCreate(history.data)
}
