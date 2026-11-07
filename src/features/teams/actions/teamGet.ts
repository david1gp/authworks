import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { TeamResponse } from "../public/teamResponseSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"
import { teamRefResolve } from "./teamRefResolve.js"
import { teamViewAssemble } from "./teamViewAssemble.js"

type TeamGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly teamRef: string
}

export function teamGet(options: TeamGetOptions): Result<TeamResponse> {
  const op = "teamGet"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const repository = teamRepositoryCreate(options.database.db)
  const organization = organizationRepository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization was not found.", "teams.not-found")
  const resolved = teamRefResolve({
    organizationId: options.organizationId,
    repository,
    teamRef: options.teamRef,
  })
  if (!resolved.success) return resolved
  if (resolved.data === null) return resultErrorCodedCreate(op, "The team was not found.", "teams.not-found")
  const authorized = teamContextAuthorize({
    context: options.context,
    database: options.database,
    leaderAllowed: true,
    organization: organization.data,
    organizationRepository,
    team: resolved.data,
    teamRepository: repository,
  })
  if (!authorized.success) return authorized
  const memberships = repository.teamMembershipListByTeam(resolved.data.id)
  if (!memberships.success) return memberships
  const view = teamViewAssemble({
    database: options.database,
    memberCount: memberships.data.length,
    realmId: options.realmId,
    row: resolved.data,
  })
  if (!view.success) return view
  return resultCreate({ team: view.data })
}
