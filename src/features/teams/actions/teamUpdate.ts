import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { teamNameNormalize } from "../domain/teamNameNormalize.js"
import { teamSlugNormalize } from "../domain/teamSlugNormalize.js"
import { teamEventTypes } from "../events/teamEventTypes.js"
import { teamLeaderChangedEventPayloadSchema } from "../events/teamLeaderChangedEventPayloadSchema.js"
import { teamMemberAssignedEventPayloadSchema } from "../events/teamMemberAssignedEventPayloadSchema.js"
import { teamUpdatedEventPayloadSchema } from "../events/teamUpdatedEventPayloadSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { TeamResponse } from "../public/teamResponseSchema.js"
import { type TeamUpdateRequest, teamUpdateRequestSchema } from "../public/teamUpdateRequestSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"
import { teamMemberEligibilityResolve } from "./teamMemberEligibilityResolve.js"
import { teamRefResolve } from "./teamRefResolve.js"
import { teamViewAssemble } from "./teamViewAssemble.js"

type TeamUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: TeamUpdateRequest
  readonly realmId: string
  readonly organizationId: string
  readonly teamRef: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function teamUpdate(options: TeamUpdateOptions): Result<TeamResponse> {
  const op = "teamUpdate"
  const parsed = patchInputParse(op, teamUpdateRequestSchema, options.input, "teams.empty-patch", "teams.invalid")
  if (!parsed.success) return parsed
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The team timestamp is invalid.", "teams.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const updated = storageTransactionRun(options.database, (transaction) => {
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
    const current = resolved.data
    const authorized = teamContextAuthorize({
      context: options.context,
      database: options.database,
      leaderAllowed: true,
      organization: organization.data,
      organizationRepository,
      team: current,
      teamRepository: repository,
    })
    if (!authorized.success) return authorized
    if (
      parsed.data.leaderUserId !== undefined &&
      parsed.data.leaderUserId !== current.leaderUserId &&
      authorized.data.scope !== "admin"
    )
      return resultErrorCodedCreate(
        op,
        "Only organization administrators can change the team leader.",
        "teams.forbidden",
      )
    let name = current.name
    if (parsed.data.name !== undefined) {
      const normalized = teamNameNormalize(parsed.data.name)
      if (!normalized.success) return normalized
      name = normalized.data
      if (name !== current.name) {
        const nameTaken = repository.teamGetByName(options.organizationId, name)
        if (!nameTaken.success) return nameTaken
        if (nameTaken.data !== null && nameTaken.data.id !== current.id)
          return resultErrorCodedCreate(
            op,
            "A team with that name already exists in this organization.",
            "teams.name-conflict",
          )
      }
    }
    let slug = current.slug
    if (parsed.data.slug !== undefined) {
      const normalized = teamSlugNormalize(parsed.data.slug)
      if (!normalized.success) return normalized
      slug = normalized.data
      if (slug !== current.slug) {
        const slugTaken = repository.teamGetBySlug(options.organizationId, slug)
        if (!slugTaken.success) return slugTaken
        if (slugTaken.data !== null && slugTaken.data.id !== current.id)
          return resultErrorCodedCreate(
            op,
            "A team with that slug already exists in this organization.",
            "teams.slug-conflict",
          )
      }
    }
    let leaderUserId = current.leaderUserId
    let leaderChanged = false
    if (parsed.data.leaderUserId !== undefined && parsed.data.leaderUserId !== current.leaderUserId) {
      const eligible = teamMemberEligibilityResolve({
        database: transaction,
        organizationId: options.organizationId,
        realmId: options.realmId,
        repository: organizationRepository,
        userId: parsed.data.leaderUserId,
      })
      if (!eligible.success) return eligible
      const alreadyLeading = repository.teamListByLeader(options.organizationId, parsed.data.leaderUserId)
      if (!alreadyLeading.success) return alreadyLeading
      if (alreadyLeading.data.some((team) => team.id !== current.id))
        return resultErrorCodedCreate(
          op,
          "The user already leads another team in this organization.",
          "teams.leader-conflict",
        )
      leaderUserId = parsed.data.leaderUserId
      leaderChanged = true
    }
    const team = repository.teamUpdate(current.id, {
      leaderUserId,
      name,
      slug,
      updatedAt,
      version: current.version + 1,
    })
    if (!team.success) return team
    if (team.data === null) return resultErrorCodedCreate(op, "The team was not found.", "teams.not-found")
    if (name !== current.name || slug !== current.slug) {
      const payload = v.safeParse(teamUpdatedEventPayloadSchema, {
        ...(name !== current.name ? { name } : {}),
        ...(slug !== current.slug ? { slug } : {}),
        teamId: current.id,
      })
      if (!payload.success)
        return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
      const event = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: current.id,
          aggregateType: "team",
          aggregateVersion: team.data.version,
          commandIndex: 0,
          correlationId,
          eventType: teamEventTypes.updated,
          metadata: { source: "teams" },
          occurredAt: updatedAt,
          payload: payload.output,
          realmId: options.realmId,
        },
        runtime,
      )
      if (!event.success) return event
    }
    if (leaderChanged) {
      const moved = repository.teamMembershipGetByOrganizationUser(options.organizationId, leaderUserId)
      if (!moved.success) return moved
      let membershipId: string
      let previousTeamId: string | undefined
      if (moved.data === null || moved.data.teamId !== current.id) {
        if (moved.data !== null) {
          previousTeamId = moved.data.teamId
          const removed = repository.teamMembershipDeleteByOrganizationUser(options.organizationId, leaderUserId)
          if (!removed.success) return removed
        }
        const membership = repository.teamMembershipCreate({
          createdAt: updatedAt,
          id: uuidv7Create(runtime),
          organizationId: options.organizationId,
          realmId: options.realmId,
          teamId: current.id,
          updatedAt,
          userId: leaderUserId,
          version: 1,
        })
        if (!membership.success) return membership
        membershipId = membership.data.id
        const assignedPayload = v.safeParse(teamMemberAssignedEventPayloadSchema, {
          membershipId,
          ...(previousTeamId === undefined ? {} : { previousTeamId }),
          teamId: current.id,
          userId: leaderUserId,
        })
        if (!assignedPayload.success)
          return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
        const assignedEvent = storageEventAppend(
          transaction,
          {
            actorId: options.context.actorId,
            aggregateId: membershipId,
            aggregateType: "team_membership",
            aggregateVersion: 1,
            commandIndex: 0,
            correlationId,
            eventType: teamEventTypes.memberAssigned,
            metadata: { source: "teams" },
            occurredAt: updatedAt,
            payload: assignedPayload.output,
            realmId: options.realmId,
          },
          runtime,
        )
        if (!assignedEvent.success) return assignedEvent
      } else {
        membershipId = moved.data.id
      }
      const leaderPayload = v.safeParse(teamLeaderChangedEventPayloadSchema, {
        leaderUserId,
        previousLeaderUserId: current.leaderUserId,
        teamId: current.id,
      })
      if (!leaderPayload.success)
        return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
      const leaderEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: current.id,
          aggregateType: "team",
          aggregateVersion: team.data.version,
          commandIndex: 0,
          correlationId,
          eventType: teamEventTypes.leaderChanged,
          metadata: { source: "teams" },
          occurredAt: updatedAt,
          payload: leaderPayload.output,
          realmId: options.realmId,
        },
        runtime,
      )
      if (!leaderEvent.success) return leaderEvent
    }
    return resultCreate(team.data)
  })
  if (!updated.success) return updated
  const memberships = teamRepositoryCreate(options.database.db).teamMembershipListByTeam(updated.data.id)
  if (!memberships.success) return memberships
  const view = teamViewAssemble({
    database: options.database,
    memberCount: memberships.data.length,
    realmId: options.realmId,
    row: updated.data,
  })
  if (!view.success) return view
  return resultCreate({ team: view.data })
}
