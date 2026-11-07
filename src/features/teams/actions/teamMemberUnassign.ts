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
import { teamMemberUnassignedEventPayloadSchema } from "../events/teamMemberUnassignedEventPayloadSchema.js"
import { teamRepositoryCreate } from "../persistence/teamRepositoryCreate.js"
import type { TeamMemberUnassignResponse } from "../public/teamMemberUnassignResponseSchema.js"
import { teamContextAuthorize } from "./teamContextAuthorize.js"
import { teamRefResolve } from "./teamRefResolve.js"

type TeamMemberUnassignOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly teamRef: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function teamMemberUnassign(options: TeamMemberUnassignOptions): Result<TeamMemberUnassignResponse> {
  const op = "teamMemberUnassign"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The team is not available in this tenant context.", "teams.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const unassignedAt = runtime.now()
  if (!Number.isSafeInteger(unassignedAt) || unassignedAt < 0)
    return resultErrorCodedCreate(op, "The team timestamp is invalid.", "teams.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
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
    if (resolved.data.leaderUserId === options.userId)
      return resultErrorCodedCreate(
        op,
        "The team leader cannot be removed without transferring leadership first.",
        "teams.leader-conflict",
      )
    const existing = repository.teamMembershipGetByOrganizationUser(options.organizationId, options.userId)
    if (!existing.success) return existing
    if (existing.data === null || existing.data.teamId !== resolved.data.id)
      return resultErrorCodedCreate(op, "The team membership was not found.", "teams.not-found")
    const removed = repository.teamMembershipDeleteByOrganizationUser(options.organizationId, options.userId)
    if (!removed.success) return removed
    if (removed.data === null)
      return resultErrorCodedCreate(op, "The team membership was not found.", "teams.not-found")
    const payload = v.safeParse(teamMemberUnassignedEventPayloadSchema, {
      membershipId: removed.data.id,
      teamId: resolved.data.id,
      userId: removed.data.userId,
    })
    if (!payload.success) return resultErrorCodedCreate(op, "The team event payload is invalid.", "teams.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: removed.data.id,
        aggregateType: "team_membership",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: teamEventTypes.memberUnassigned,
        metadata: { source: "teams" },
        occurredAt: unassignedAt,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ unassigned: true as const })
  })
}
