import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { teamEventTypes } from "../events/teamEventTypes.js"
import { teamMemberAssignedEventPayloadSchema } from "../events/teamMemberAssignedEventPayloadSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import { type TeamMemberAssignRequest, teamMemberAssignRequestSchema } from "../public/teamMemberAssignRequestSchema.js"
import type { TeamMemberAssignResponse } from "../public/teamMemberAssignResponseSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"
import { teamMemberEligibilityResolve } from "./teamMemberEligibilityResolve.js"
import { teamRefResolve } from "./teamRefResolve.js"
import { teamViewAssemble } from "./teamViewAssemble.js"

type TeamMemberAssignOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: TeamMemberAssignRequest
  readonly realmId: string
  readonly organizationId: string
  readonly teamRef: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function teamMemberAssign(options: TeamMemberAssignOptions): Result<TeamMemberAssignResponse> {
  const op = "teamMemberAssign"
  const parsed = v.safeParse(teamMemberAssignRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The team member request is invalid.", "teams.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const assignedAt = runtime.now()
  if (!Number.isSafeInteger(assignedAt) || assignedAt < 0)
    return resultErrorCodedCreate(op, "The team timestamp is invalid.", "teams.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const assigned = storageTransactionRun(options.database, (transaction) => {
    const organizationRepository = organizationRepositoryCreate(transaction)
    const repository = teamRepositoryCreate(transaction)
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
    const eligible = teamMemberEligibilityResolve({
      database: transaction,
      organizationId: options.organizationId,
      realmId: options.realmId,
      repository: organizationRepository,
      userId: parsed.output.userId,
    })
    if (!eligible.success) return eligible
    const existing = repository.teamMembershipGetByOrganizationUser(options.organizationId, parsed.output.userId)
    if (!existing.success) return existing
    if (existing.data !== null && existing.data.teamId === resolved.data.id)
      return resultCreate({ moved: false as boolean, previousTeamId: undefined as string | undefined })
    const alreadyLeading = repository.teamListByLeader(options.organizationId, parsed.output.userId)
    if (!alreadyLeading.success) return alreadyLeading
    const targetTeamId = resolved.data.id
    if (alreadyLeading.data.some((team) => team.id !== targetTeamId))
      return resultErrorCodedCreate(
        op,
        "The user already leads another team in this organization.",
        "teams.leader-conflict",
      )
    // Leader-scoped assigns may only add people who are currently unassigned in
    // this organization (same-team assigns stay idempotent above). Moving a
    // member of another team stays an administrator operation.
    if (authorized.data.scope === "leader" && existing.data !== null && existing.data.teamId !== targetTeamId)
      return resultErrorCodedCreate(
        op,
        "Only organization administrators can move people between teams.",
        "teams.forbidden",
      )
    let previousTeamId: string | undefined
    if (existing.data !== null) {
      previousTeamId = existing.data.teamId
      const removed = repository.teamMembershipDeleteByOrganizationUser(options.organizationId, parsed.output.userId)
      if (!removed.success) return removed
    }
    const membership = repository.teamMembershipCreate({
      createdAt: assignedAt,
      id: uuidv7Create(runtime),
      organizationId: options.organizationId,
      realmId: options.realmId,
      teamId: resolved.data.id,
      updatedAt: assignedAt,
      userId: parsed.output.userId,
      version: 1,
    })
    if (!membership.success) return membership
    const payload = v.safeParse(teamMemberAssignedEventPayloadSchema, {
      membershipId: membership.data.id,
      ...(previousTeamId === undefined ? {} : { previousTeamId }),
      teamId: resolved.data.id,
      userId: parsed.output.userId,
    })
    if (!payload.success) return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: membership.data.id,
        aggregateType: "team_membership",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: teamEventTypes.memberAssigned,
        metadata: { source: "teams" },
        occurredAt: assignedAt,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ moved: true as boolean, previousTeamId })
  })
  if (!assigned.success) return assigned
  const resolved = teamRefResolve({
    organizationId: options.organizationId,
    repository: teamRepositoryCreate(options.database.db),
    teamRef: options.teamRef,
  })
  if (!resolved.success) return resolved
  if (resolved.data === null) return resultErrorCodedCreate(op, "The team was not found.", "teams.not-found")
  const memberships = teamRepositoryCreate(options.database.db).teamMembershipListByTeam(resolved.data.id)
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
