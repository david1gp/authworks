import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import type { SessionRevocationResponse } from "../public/sessionRevocationResponseSchema.js"
import { sessionRevoke } from "./sessionRevoke.js"

type SessionAdministratorRevokeOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly sessionId: string
  readonly userId: string
}

/** Revokes a target user's session while recording the administrator as the actor. */
export function sessionAdministratorRevoke(
  options: SessionAdministratorRevokeOptions,
): Result<SessionRevocationResponse> {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userManage,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  return sessionRevoke({
    actorId: authorized.data.actorId,
    database: options.database,
    reason: "administrator_requested",
    realmId: options.realmId,
    sessionId: options.sessionId,
    subjectType: "user",
    userId: options.userId,
  })
}
