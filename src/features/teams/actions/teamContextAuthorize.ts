import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../../organizations/persistence/organizationTable.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { TeamRow } from "../persistence/teamTable.js"

type TeamContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly organization: OrganizationRow
  readonly organizationRepository: ReturnType<typeof organizationRepositoryCreate>
  readonly teamRepository: ReturnType<typeof teamRepositoryCreate>
  readonly team: TeamRow | null
  readonly leaderAllowed: boolean
}

export function teamContextAuthorize(options: TeamContextAuthorizeOptions): Result<{ scope: "admin" | "leader" }> {
  const op = "teamContextAuthorize"
  if (options.context.kind === "tenant" && options.context.realmId !== options.organization.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const admin = organizationContextAuthorize({
    context: options.context,
    database: options.database,
    organization: options.organization,
    repository: options.organizationRepository,
    requiredPermission: "organization.members.manage",
  })
  if (admin.success) return resultCreate({ scope: "admin" })
  if (!options.leaderAllowed || options.team === null) return admin
  if (options.context.kind !== "tenant") return admin
  if (options.team.leaderUserId !== options.context.actorId) return admin
  const membership = options.organizationRepository.organizationMembershipGetByOrganizationUser(
    options.organization.id,
    options.context.actorId,
  )
  if (!membership.success) return membership
  if (membership.data === null) return admin
  return resultCreate({ scope: "leader" })
}
