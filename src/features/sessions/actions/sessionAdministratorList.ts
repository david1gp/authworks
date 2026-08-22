import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { sessionList } from "./sessionList.js"
import type { SessionListResponse } from "../public/sessionListResponseSchema.js"

type SessionAdministratorListOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly userId: string
}

/** Lists only user sessions in the actor's administered realm; the actor is never the target. */
export function sessionAdministratorList(options: SessionAdministratorListOptions): Result<SessionListResponse> {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userRead,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  return sessionList({
    database: options.database,
    query: options.query,
    realmId: options.realmId,
    subjectType: "user",
    userId: options.userId,
  })
}
