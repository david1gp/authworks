import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/server/index.js"

type UserRealmReadCapabilityResolveOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function userRealmReadCapabilityResolve(
  options: UserRealmReadCapabilityResolveOptions,
): Result<{ readonly realmRead: boolean }> {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.realmRead,
    realmId: options.realmId,
  })
  if (!authorized.success && !authorized.code?.startsWith("authorization.")) return authorized
  return resultCreate({ realmRead: authorized.success })
}
