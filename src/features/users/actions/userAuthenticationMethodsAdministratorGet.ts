import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { userAuthenticationMethodsRead } from "./userAuthenticationMethodsRead.js"
import type { UserAuthenticationMethods } from "../public/userAuthenticationMethodsSchema.js"

type UserAuthenticationMethodsAdministratorGetOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

/** Reads another realm-local user's authentication metadata after administrator authorization. */
export function userAuthenticationMethodsAdministratorGet(
  options: UserAuthenticationMethodsAdministratorGetOptions,
): Result<UserAuthenticationMethods> {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userRead,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  return userAuthenticationMethodsRead({
    context: authorized.data,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
}
