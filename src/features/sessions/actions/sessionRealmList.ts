import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { sessionList } from "./sessionList.js"

export function sessionRealmList(options: {
  actor: AuthorizationActorContext
  currentSessionId: string
  database: StorageDatabase
  query?: ListQuery
  realmId: string
}) {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userRead,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  return sessionList({
    currentSessionId: options.currentSessionId,
    database: options.database,
    query: options.query,
    realmId: options.realmId,
    realmWide: true,
  })
}
