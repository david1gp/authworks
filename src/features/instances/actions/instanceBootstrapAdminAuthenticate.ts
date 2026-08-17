import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { instanceSecretHashCreate } from "../domain/instanceSecretHashCreate.js"
import type { InstanceTenantContext } from "../domain/instanceTenantContext.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"

type InstanceBootstrapAdminAuthenticateOptions = {
  readonly context: InstanceTenantContext
  readonly database: StorageDatabase
  readonly secret: string
}

export function instanceBootstrapAdminAuthenticate(
  options: InstanceBootstrapAdminAuthenticateOptions,
): Result<InstanceTenantContext> {
  const op = "instanceBootstrapAdminAuthenticate"
  if (options.context?.kind !== "tenant") return resultErrorCreate(op, "A tenant context is required.")
  const admin = instanceRepositoryCreate(options.database.db).instanceBootstrapAdminGet(options.context.instanceId)
  if (!admin.success) return admin
  if (admin.data === null || !secretMatches(instanceSecretHashCreate(options.secret), admin.data.secretHash))
    return resultErrorCreate(op, "The bootstrap administrator credentials are invalid.")
  const actor: AuthorizationActorContext = {
    actorId: admin.data.adminId,
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    instanceId: options.context.instanceId,
    kind: "bootstrap_admin",
  }
  return resultCreate({ ...options.context, actor, actorId: admin.data.adminId })
}
