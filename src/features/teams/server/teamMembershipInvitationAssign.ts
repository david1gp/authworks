import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { teamEventTypes } from "../events/teamEventTypes.js"
import { teamMemberAssignedEventPayloadSchema } from "../events/teamMemberAssignedEventPayloadSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"

type TeamMembershipInvitationAssignOptions = {
  readonly database: StorageExecutor
  readonly realmId: string
  readonly organizationId: string
  readonly teamId: string
  readonly userId: string
  readonly occurredAt: number
  readonly actorId: string | null
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId: string
}

type TeamMembershipInvitationAssignOutcome = {
  readonly assigned: boolean
  readonly skipped?: "leader-conflict" | "team-not-found"
}

/**
 * Transaction-scoped team assignment for invitation acceptance. Move semantics
 * apply (one team per person); a leader-conflict or a missing team skips the
 * assignment without failing the organization membership.
 */
export function teamMembershipInvitationAssign(
  options: TeamMembershipInvitationAssignOptions,
): Result<TeamMembershipInvitationAssignOutcome> {
  const op = "teamMembershipInvitationAssign"
  if (
    options.realmId.length === 0 ||
    options.organizationId.length === 0 ||
    options.teamId.length === 0 ||
    options.userId.length === 0
  )
    return resultErrorCodedCreate(op, "The team assignment is invalid.", "teams.invalid")
  if (!Number.isSafeInteger(options.occurredAt) || options.occurredAt < 0)
    return resultErrorCodedCreate(op, "The team timestamp is invalid.", "teams.invalid-timestamp")
  const repository = teamRepositoryCreate(options.database)
  const team = repository.teamGet(options.teamId)
  if (!team.success) return team
  if (
    team.data === null ||
    team.data.organizationId !== options.organizationId ||
    team.data.realmId !== options.realmId
  )
    return resultCreate({ assigned: false as boolean, skipped: "team-not-found" as const })
  const existing = repository.teamMembershipGetByOrganizationUser(options.organizationId, options.userId)
  if (!existing.success) return existing
  if (existing.data !== null && existing.data.teamId === options.teamId) return resultCreate({ assigned: true })
  const alreadyLeading = repository.teamListByLeader(options.organizationId, options.userId)
  if (!alreadyLeading.success) return alreadyLeading
  if (alreadyLeading.data.some((row) => row.id !== options.teamId))
    return resultCreate({ assigned: false as boolean, skipped: "leader-conflict" as const })
  let previousTeamId: string | undefined
  if (existing.data !== null) {
    previousTeamId = existing.data.teamId
    const removed = repository.teamMembershipDeleteByOrganizationUser(options.organizationId, options.userId)
    if (!removed.success) return removed
  }
  const membership = repository.teamMembershipCreate({
    createdAt: options.occurredAt,
    id: uuidv7Create(options.runtime),
    organizationId: options.organizationId,
    realmId: options.realmId,
    teamId: options.teamId,
    updatedAt: options.occurredAt,
    userId: options.userId,
    version: 1,
  })
  if (!membership.success) return membership
  const payload = v.safeParse(teamMemberAssignedEventPayloadSchema, {
    membershipId: membership.data.id,
    ...(previousTeamId === undefined ? {} : { previousTeamId }),
    teamId: options.teamId,
    userId: options.userId,
  })
  if (!payload.success) return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.actorId,
      aggregateId: membership.data.id,
      aggregateType: "team_membership",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: teamEventTypes.memberAssigned,
      metadata: { source: "teams" },
      occurredAt: options.occurredAt,
      payload: payload.output,
      realmId: options.realmId,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ assigned: true })
}
