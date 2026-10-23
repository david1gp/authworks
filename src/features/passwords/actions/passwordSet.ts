import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmAdministratorIs } from "../../realms/server/realmAdministratorIs.js"
import { passwordCredentialReplace } from "./passwordCredentialReplace.js"

type PasswordSetOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly password: Secret
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

// Realm administrators (and bootstrap admins) set a user's password without
// knowing the current one. Organization owners/admins are explicitly NOT
// allowed: the first check enforces the targeted permission through the
// realm-admin path semantics, then a dedicated realm-administrator check
// gates the call.
export function passwordSet(options: PasswordSetOptions): Result<{ changed: boolean }> {
  const op = "passwordSet"
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userManage,
    realmId: options.realmId,
    targetUserId: options.userId,
  })
  if (!authorized.success) return authorized
  const administrator = realmAdministratorOrBootstrap(options.actor, options.database, options.realmId)
  if (!administrator.success) return administrator
  if (!administrator.data)
    return resultErrorCreate(op, "Only realm administrators can set a user password.", "passwords.forbidden")
  const replaced = passwordCredentialReplace({
    context: realmSystemContextCreate(authorized.data.actorId),
    ...(options.correlationId === undefined ? {} : { correlationId: options.correlationId }),
    database: options.database,
    password: options.password,
    realmId: options.realmId,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    userId: options.userId,
  })
  if (!replaced.success) return replaced
  return resultCreate({ changed: replaced.data.changed })
}

function realmAdministratorOrBootstrap(
  actor: AuthorizationActorContext,
  database: StorageDatabase,
  realmId: string,
): Result<boolean> {
  if (actor.kind === "bootstrap_admin") return resultCreate(true)
  if (actor.kind !== "user") return resultCreate(false)
  const administrator = realmAdministratorIs({ database, realmId, userId: actor.actorId })
  if (!administrator.success) return administrator
  return resultCreate(administrator.data)
}
