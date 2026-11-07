import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { secretGenerate } from "../../../platform/secrets/secretGenerate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { teamOrganizationAssignmentList } from "../../teams/server/teamOrganizationAssignmentList.js"
import { organizationEmailNormalize } from "../domain/organizationEmailNormalize.js"
import { organizationInvitationTokenHashCreate } from "../domain/organizationInvitationTokenHashCreate.js"
import { organizationRolesEncode } from "../domain/organizationRolesEncode.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationInvitationCreatedEventPayloadSchema } from "../events/organizationInvitationCreatedEventPayloadSchema.js"
import { organizationInvitationStatusEventPayloadSchema } from "../events/organizationInvitationStatusEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationInvitationCreateRequest,
  organizationInvitationCreateRequestSchema,
} from "../public/organizationInvitationCreateRequestSchema.js"
import type { OrganizationInvitationCreateResponse } from "../public/organizationInvitationCreateResponseSchema.js"
import type { OrganizationInvitationDelivery } from "../public/organizationInvitationDeliverySchema.js"
import { organizationInvitationViewsAssemble } from "../server/organizationInvitationViewsAssemble.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationInvitationCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationInvitationCreateRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly onInvitationDelivery?: (delivery: OrganizationInvitationDelivery) => void | Promise<void>
}

export function organizationInvitationCreate(
  options: OrganizationInvitationCreateOptions,
): Result<OrganizationInvitationCreateResponse> {
  const op = "organizationInvitationCreate"
  const parsed = v.safeParse(organizationInvitationCreateRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization invitation request is invalid.", "organizations.invalid")
  const email = organizationEmailNormalize(parsed.output.email)
  if (!email.success) return email
  const roles = organizationRolesEncode(parsed.output.roles)
  if (!roles.success) return roles
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The invitation timestamp is invalid.", "organizations.invalid-timestamp")
  const expiresAt = parsed.output.expiresAt ?? createdAt + 7 * 24 * 60 * 60 * 1000
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= createdAt)
    return resultErrorCodedCreate(op, "The invitation expiry is invalid.", "organizations.invalid-expiry")
  const token = secretGenerate(32, runtime)
  const invitationId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const organization = repository.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      return resultErrorCodedCreate(op, "The organization is not active or was not found.", "organizations.not-found")
    let teamLeaderUserId: string | null = null
    if (parsed.output.teamId !== undefined) {
      const assignments = teamOrganizationAssignmentList({
        database: transaction,
        organizationId: options.organizationId,
        realmId: options.realmId,
      })
      if (!assignments.success) return assignments
      const target = assignments.data.teams.find((candidate) => candidate.id === parsed.output.teamId)
      if (target === undefined)
        return resultErrorCodedCreate(op, "The invitation team was not found.", "teams.not-found")
      teamLeaderUserId = target.leaderUserId
    }
    const authorized = organizationContextAuthorize({
      context: options.context,
      database: options.database,
      organization: organization.data,
      repository,
      requiredPermission: "organization.members.manage",
      requireOwner: parsed.output.roles.includes("owner"),
    })
    if (!authorized.success) {
      if (parsed.output.roles.includes("admin") || parsed.output.roles.includes("owner")) return authorized
      const leaderAllowed = organizationInvitationLeaderAllowed({
        actorId: options.context.kind === "tenant" ? options.context.actorId : null,
        isTenantUser: options.context.kind === "tenant" && options.context.actor.kind === "user",
        organizationId: options.organizationId,
        repository,
        rolesIncludeOwner: parsed.output.roles.includes("owner"),
        teamId: parsed.output.teamId,
        teamLeaderUserId,
      })
      if (!leaderAllowed.success) return leaderAllowed
      if (!leaderAllowed.data) return authorized
    }

    let commandIndex = 0
    const previous = repository.organizationInvitationPendingByEmail(options.organizationId, email.data)
    if (!previous.success) return previous
    if (previous.data !== null) {
      const revoked = repository.organizationInvitationUpdate(previous.data.id, {
        status: "revoked",
        updatedAt: createdAt,
        version: previous.data.version + 1,
      })
      if (!revoked.success) return revoked
      if (revoked.data === null)
        return resultErrorCodedCreate(op, "The previous invitation was not found.", "organizations.not-found")
      const revokePayload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
        invitationId: revoked.data.id,
        status: "revoked",
      })
      if (!revokePayload.success)
        return resultErrorCodedCreate(op, "The invitation event payload is invalid.", "organizations.event-invalid")
      const revokeEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: revoked.data.id,
          aggregateType: "organization_invitation",
          aggregateVersion: revoked.data.version,
          commandIndex,
          correlationId,
          eventType: organizationEventTypes.invitationRevoked,
          realmId: options.realmId,
          metadata: { source: "organizations" },
          occurredAt: createdAt,
          payload: revokePayload.output,
        },
        runtime,
      )
      if (!revokeEvent.success) return revokeEvent
      commandIndex += 1
    }

    const invitation = repository.organizationInvitationCreate({
      createdAt,
      email: email.data,
      expiresAt,
      id: invitationId,
      realmId: options.realmId,
      invitedBy: options.context.actorId,
      organizationId: options.organizationId,
      roles: roles.data,
      status: "pending",
      teamId: parsed.output.teamId ?? null,
      tokenHash: organizationInvitationTokenHashCreate(token.valueGet()),
      updatedAt: createdAt,
      version: 1,
    })
    if (!invitation.success) return invitation
    const payload = v.safeParse(organizationInvitationCreatedEventPayloadSchema, {
      email: email.data,
      expiresAt,
      invitationId,
      roles: parsed.output.roles,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The invitation event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: invitationId,
        aggregateType: "organization_invitation",
        aggregateVersion: 1,
        commandIndex,
        correlationId,
        eventType: organizationEventTypes.invitationCreated,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      delivery: {
        email: email.data,
        entityName: organization.data.name,
        invitedByEmail: options.context.actorId,
        invitedByName: options.context.actorId,
        invitedName: email.data,
        token: token.valueGet(),
      },
      row: invitation.data,
      token: token.valueGet(),
    })
  })
  if (!committed.success) return committed
  try {
    if (options.onInvitationDelivery !== undefined) {
      void Promise.resolve(options.onInvitationDelivery(committed.data.delivery)).catch(() => undefined)
    }
  } catch (_error) {}
  const views = organizationInvitationViewsAssemble({
    database: options.database,
    realmId: options.realmId,
    rows: [committed.data.row],
  })
  if (!views.success) return views
  const view = views.data[0]
  if (view === undefined)
    return resultErrorCodedCreate(op, "The organization invitation could not be read.", "organizations.read-failed")
  return resultCreate({ invitation: view, token: committed.data.token })
}

function organizationInvitationLeaderAllowed(input: {
  readonly actorId: string | null
  readonly isTenantUser: boolean
  readonly organizationId: string
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
  readonly rolesIncludeOwner: boolean
  readonly teamId: string | undefined
  readonly teamLeaderUserId: string | null
}): Result<boolean> {
  if (!input.isTenantUser || input.actorId === null) return resultCreate(false)
  if (input.teamId === undefined || input.rolesIncludeOwner) return resultCreate(false)
  if (input.teamLeaderUserId !== input.actorId) return resultCreate(false)
  const membership = input.repository.organizationMembershipGetByOrganizationUser(input.organizationId, input.actorId)
  if (!membership.success) return membership
  if (membership.data === null) return resultCreate(false)
  return resultCreate(true)
}
