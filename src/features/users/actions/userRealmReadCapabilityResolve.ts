import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize, realmAdministratorIs } from "../../realms/server/index.js"

type UserRealmReadCapabilityResolveOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function userRealmReadCapabilityResolve(
  options: UserRealmReadCapabilityResolveOptions,
): Result<{ readonly realmAdministrator: boolean; readonly realmRead: boolean }> {
  if (options.actor.kind === "bootstrap_admin" && options.actor.realmId === options.realmId)
    return resultCreate({ realmAdministrator: true, realmRead: true })
  if (options.actor.kind === "user" && options.actor.realmId === options.realmId) {
    const administrator = realmAdministratorIs({
      database: options.database,
      realmId: options.realmId,
      userId: options.actor.actorId,
    })
    if (!administrator.success) return administrator
    if (administrator.data) return resultCreate({ realmAdministrator: true, realmRead: true })
  }
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.realmRead,
    realmId: options.realmId,
  })
  if (!authorized.success && authorized.code !== undefined && !authorized.code.startsWith("authorization."))
    return resultErrorCodedCreate(authorized.op, authorized.errorMessage, authorized.code)
  return resultCreate({ realmAdministrator: false, realmRead: authorized.success })
}
