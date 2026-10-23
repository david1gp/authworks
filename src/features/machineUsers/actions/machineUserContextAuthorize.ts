import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"

type MachineUserContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly minimumAssurance?: SessionAssurance
  readonly permission?: "machine.credential.manage" | "machine.user.manage"
}

export function machineUserContextAuthorize(options: MachineUserContextAuthorizeOptions): Result<void> {
  const op = "machineUserContextAuthorize"
  if (options.organizationId.length === 0)
    return resultErrorCreate(op, "The organization is required.", "machine-users.invalid")
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization was not found.", "machine-users.not-found")
  if (organization.data.status === "removed")
    return resultErrorCreate(op, "The organization was not found.", "machine-users.not-found")
  if (organization.data.status !== "active")
    return resultErrorCreate(op, "The organization is not active.", "machine-users.not-active")
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The machine user is not available in this tenant context.",
      "machine-users.tenant-mismatch",
    )
  if (options.context.actor.kind === "user")
    return organizationContextAuthorize({
      context: options.context,
      database: options.database,
      minimumAssurance: options.minimumAssurance,
      organization: organization.data,
      repository: organizationRepositoryCreate(options.database.db),
      requiredPermission: options.permission ?? "machine.user.manage",
    })
  if (
    options.minimumAssurance !== undefined &&
    machineUserAssuranceRankGet(options.context.actor.assurance) < machineUserAssuranceRankGet(options.minimumAssurance)
  )
    return resultErrorCreate(op, "A stronger authentication is required.", "authorization.insufficient-assurance")
  return authorizationEnforce({
    actor: options.context.actor,
    realmId: options.realmId,
    organizationId: options.organizationId,
    permission: options.permission ?? "machine.user.manage",
  })
}

function machineUserAssuranceRankGet(assurance: SessionAssurance): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}
