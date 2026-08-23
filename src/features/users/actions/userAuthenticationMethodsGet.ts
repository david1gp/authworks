import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { UserAuthenticationMethods } from "../public/userAuthenticationMethodsSchema.js"
import { userAuthenticationMethodsRead } from "./userAuthenticationMethodsRead.js"

type UserAuthenticationMethodsGetOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

export function userAuthenticationMethodsGet(
  options: UserAuthenticationMethodsGetOptions,
): Result<UserAuthenticationMethods> {
  const op = "userAuthenticationMethodsGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind !== "tenant" || options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The authentication methods are not available in this tenant context.",
      "users.tenant-mismatch",
    )
  if (
    options.context.actor.kind !== "user" ||
    options.context.actor.actorId !== options.userId ||
    options.context.actor.assurance === "none"
  )
    return resultErrorCreate(op, "The authentication methods are not available for this subject.", "users.forbidden")

  return userAuthenticationMethodsRead({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
}
