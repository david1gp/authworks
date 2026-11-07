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
import { teamNameNormalize } from "../domain/teamNameNormalize.js"
import { teamSlugNormalize } from "../domain/teamSlugNormalize.js"
import { teamCreatedEventPayloadSchema } from "../events/teamCreatedEventPayloadSchema.js"
import { teamEventTypes } from "../events/teamEventTypes.js"
import { teamMemberAssignedEventPayloadSchema } from "../events/teamMemberAssignedEventPayloadSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import { type TeamCreateRequest, teamCreateRequestSchema } from "../public/teamCreateRequestSchema.js"
import type { TeamResponse } from "../public/teamResponseSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"
import { teamMemberEligibilityResolve } from "./teamMemberEligibilityResolve.js"
import { teamViewAssemble } from "./teamViewAssemble.js"

type TeamCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: TeamCreateRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function teamCreate(options: TeamCreateOptions): Result<TeamResponse> {
  const op = "teamCreate"
  const parsed = v.safeParse(teamCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The team request is invalid.", "teams.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The team timestamp is invalid.", "teams.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const created = storageTransactionRun(options.database, (transaction) => {
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
    const authorized = teamContextAuthorize({
      context: options.context,
      database: options.database,
      leaderAllowed: false,
      organization: organization.data,
      organizationRepository,
      team: null,
      teamRepository: repository,
    })
    if (!authorized.success) return authorized
    const name = teamNameNormalize(parsed.output.name)
    if (!name.success) return name
    const slug = teamSlugNormalize(parsed.output.slug)
    if (!slug.success) return slug
    const eligible = teamMemberEligibilityResolve({
      database: transaction,
      organizationId: options.organizationId,
      realmId: options.realmId,
      repository: organizationRepository,
      userId: parsed.output.leaderUserId,
    })
    if (!eligible.success) return eligible
    const slugTaken = repository.teamGetBySlug(options.organizationId, slug.data)
    if (!slugTaken.success) return slugTaken
    if (slugTaken.data !== null)
      return resultErrorCodedCreate(
        op,
        "A team with that slug already exists in this organization.",
        "teams.slug-conflict",
      )
    const nameTaken = repository.teamGetByName(options.organizationId, name.data)
    if (!nameTaken.success) return nameTaken
    if (nameTaken.data !== null)
      return resultErrorCodedCreate(
        op,
        "A team with that name already exists in this organization.",
        "teams.name-conflict",
      )
    const alreadyLeading = repository.teamListByLeader(options.organizationId, parsed.output.leaderUserId)
    if (!alreadyLeading.success) return alreadyLeading
    if (alreadyLeading.data.length > 0)
      return resultErrorCodedCreate(
        op,
        "The user already leads another team in this organization.",
        "teams.leader-conflict",
      )
    const teamId = uuidv7Create(runtime)
    const previousAssignment = repository.teamMembershipGetByOrganizationUser(
      options.organizationId,
      parsed.output.leaderUserId,
    )
    if (!previousAssignment.success) return previousAssignment
    let previousTeamId: string | undefined
    if (previousAssignment.data !== null) {
      previousTeamId = previousAssignment.data.teamId
      const removed = repository.teamMembershipDeleteByOrganizationUser(
        options.organizationId,
        parsed.output.leaderUserId,
      )
      if (!removed.success) return removed
    }
    const team = repository.teamCreate({
      createdAt,
      id: teamId,
      leaderUserId: parsed.output.leaderUserId,
      name: name.data,
      organizationId: options.organizationId,
      realmId: options.realmId,
      slug: slug.data,
      updatedAt: createdAt,
      version: 1,
    })
    if (!team.success) return team
    const membership = repository.teamMembershipCreate({
      createdAt,
      id: uuidv7Create(runtime),
      organizationId: options.organizationId,
      realmId: options.realmId,
      teamId,
      updatedAt: createdAt,
      userId: parsed.output.leaderUserId,
      version: 1,
    })
    if (!membership.success) return membership
    const createdPayload = v.safeParse(teamCreatedEventPayloadSchema, {
      leaderUserId: parsed.output.leaderUserId,
      name: name.data,
      slug: slug.data,
      teamId,
    })
    if (!createdPayload.success)
      return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
    const createdEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: teamId,
        aggregateType: "team",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: teamEventTypes.created,
        metadata: { source: "teams" },
        occurredAt: createdAt,
        payload: createdPayload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!createdEvent.success) return createdEvent
    const assignedPayload = v.safeParse(teamMemberAssignedEventPayloadSchema, {
      membershipId: membership.data.id,
      ...(previousTeamId === undefined ? {} : { previousTeamId }),
      teamId,
      userId: parsed.output.leaderUserId,
    })
    if (!assignedPayload.success)
      return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
    const assignedEvent = storageEventAppend(
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
        occurredAt: createdAt,
        payload: assignedPayload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!assignedEvent.success) return assignedEvent
    return resultCreate(team.data)
  })
  if (!created.success) return created
  const view = teamViewAssemble({
    database: options.database,
    memberCount: 1,
    realmId: options.realmId,
    row: created.data,
  })
  if (!view.success) return view
  return resultCreate({ team: view.data })
}
