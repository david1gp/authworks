import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { realmAdministratorContextAuthorize } from "../../realms/server/index.js"

type UserMetadataAuthorizeOptions = {
  readonly allowSelfRead: boolean
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly permission: AuthorizationPermission
  readonly realmId: string
  readonly userId: string
}

/**
 * Authorizes user metadata access. Reads allow self-read of the caller's own
 * metadata; writes never do (user metadata is admin-managed, like Zitadel).
 * Machine credentials inherit their scopes via authorizationEnforce.
 */
export function userMetadataAuthorize(options: UserMetadataAuthorizeOptions): Result<void> {
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.allowSelfRead && options.context.actor.kind === "user" && options.context.actorId === options.userId)
    return resultCreate(undefined)
  if (options.context.actor.kind === "machine")
    return authorizationEnforce({
      actor: options.context.actor,
      permission: options.permission,
      realmId: options.realmId,
    })
  const authorized = realmAdministratorContextAuthorize({
    actor: options.context.actor,
    database: options.database,
    permission: options.permission,
    realmId: options.realmId,
    targetUserId: options.userId,
  })
  if (!authorized.success) return authorized
  return resultCreate(undefined)
}
