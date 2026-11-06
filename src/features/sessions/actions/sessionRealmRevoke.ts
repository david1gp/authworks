import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import { sessionRevoke } from "./sessionRevoke.js"

export function sessionRealmRevoke(options: {
  actor: AuthorizationActorContext
  database: StorageDatabase
  realmId: string
  sessionId: string
}) {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userManage,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  const session = sessionRepositoryCreate(options.database.db).sessionGet(options.realmId, options.sessionId)
  if (!session.success) return session
  if (session.data === null || (session.data.subjectType !== "user" && session.data.subjectType !== "bootstrap_admin"))
    return resultErrorCodedCreate("sessionRealmRevoke", "The session could not be found.", "sessions.not-found")
  return sessionRevoke({
    actorId: authorized.data.actorId,
    database: options.database,
    reason: "administrator_requested",
    realmId: options.realmId,
    sessionId: options.sessionId,
    subjectType: session.data.subjectType,
    userId: session.data.subjectId,
  })
}
