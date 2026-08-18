import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { realmSecretHashCreate } from "../domain/realmSecretHashCreate.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"

type RealmBootstrapAdminAuthenticateOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly secret: string
}

export function realmBootstrapAdminAuthenticate(
  options: RealmBootstrapAdminAuthenticateOptions,
): Result<RealmTenantContext> {
  const op = "realmBootstrapAdminAuthenticate"
  if (options.context?.kind !== "tenant")
    return resultErrorCreate(op, "A tenant context is required.", "realms.tenant-required")
  const admin = realmRepositoryCreate(options.database.db).realmBootstrapAdminGet(options.context.realmId)
  if (!admin.success) return admin
  if (admin.data === null || !secretMatches(realmSecretHashCreate(options.secret), admin.data.secretHash))
    return resultErrorCreate(op, "The bootstrap administrator credentials are invalid.", "realms.unauthorized")
  const actor: AuthorizationActorContext = {
    actorId: admin.data.adminId,
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    realmId: options.context.realmId,
    kind: "bootstrap_admin",
  }
  return resultCreate({ ...options.context, actor, actorId: admin.data.adminId })
}
