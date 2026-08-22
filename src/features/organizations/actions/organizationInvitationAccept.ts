import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationInvitationTokenHashCreate } from "../domain/organizationInvitationTokenHashCreate.js"
import { organizationMembershipPublicViewCreate } from "../domain/organizationMembershipPublicViewCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRolesEncode } from "../domain/organizationRolesEncode.js"
import { organizationRolesNormalize } from "../domain/organizationRolesNormalize.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationInvitationStatusEventPayloadSchema } from "../events/organizationInvitationStatusEventPayloadSchema.js"
import { organizationMembershipEventPayloadSchema } from "../events/organizationMembershipEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationInvitationAcceptRequest,
  organizationInvitationAcceptRequestSchema,
} from "../public/organizationInvitationAcceptRequestSchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"

type OrganizationInvitationAcceptOptions = {
  readonly database: StorageDatabase
  readonly input: OrganizationInvitationAcceptRequest
  readonly subject?: {
    readonly email: string
    readonly realmId: string
    readonly userId: string
  }
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

type OrganizationInvitationAcceptOutcome = {
  readonly expired: boolean
  readonly membership?: OrganizationMembership
}

export function organizationInvitationAccept(
  options: OrganizationInvitationAcceptOptions,
): Result<{ membership: OrganizationMembership }> {
  const op = "organizationInvitationAccept"
  const parsed = v.safeParse(organizationInvitationAcceptRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization invitation acceptance is invalid.", "organizations.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const acceptedAt = runtime.now()
  if (!Number.isSafeInteger(acceptedAt) || acceptedAt < 0)
    return resultErrorCodedCreate(op, "The invitation timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const outcome = storageTransactionRun<OrganizationInvitationAcceptOutcome>(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const invitation = repository.organizationInvitationGetByTokenHash(
      organizationInvitationTokenHashCreate(parsed.output.token),
    )
    if (!invitation.success) return invitation
    if (invitation.data === null)
      return resultErrorCodedCreate(op, "The organization invitation is invalid.", "organizations.not-found")
    if (
      options.subject !== undefined &&
      (parsed.output.userId !== options.subject.userId ||
        invitation.data.realmId !== options.subject.realmId ||
        invitation.data.email !== options.subject.email)
    )
      return resultErrorCodedCreate(op, "The organization invitation is invalid.", "organizations.not-found")
    if (invitation.data.status !== "pending")
      return resultErrorCodedCreate(op, "The organization invitation is no longer pending.", "organizations.pending")
    const organization = repository.organizationGet(invitation.data.organizationId)
    if (!organization.success) return organization
    if (organization.data === null || organization.data.status !== "active")
      return resultErrorCodedCreate(op, "The organization is not active or was not found.", "organizations.not-found")
    if (acceptedAt >= invitation.data.expiresAt) {
      const expired = repository.organizationInvitationUpdate(invitation.data.id, {
        status: "expired",
        updatedAt: acceptedAt,
        version: invitation.data.version + 1,
      })
      if (!expired.success) return expired
      if (expired.data === null)
        return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
      const expiredPayload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
        invitationId: expired.data.id,
        status: "expired",
      })
      if (!expiredPayload.success)
        return resultErrorCodedCreate(op, "The invitation event payload is invalid.", "organizations.event-invalid")
      const expiredEvent = storageEventAppend(
        transaction,
        {
          actorId: null,
          aggregateId: expired.data.id,
          aggregateType: "organization_invitation",
          aggregateVersion: expired.data.version,
          commandIndex: 0,
          correlationId,
          eventType: organizationEventTypes.invitationExpired,
          realmId: expired.data.realmId,
          metadata: { source: "organizations" },
          occurredAt: acceptedAt,
          payload: expiredPayload.output,
        },
        runtime,
      )
      if (!expiredEvent.success) return expiredEvent
      return resultCreate({ expired: true })
    }
    const invitationRoles = organizationRolesDecode(invitation.data.roles)
    if (!invitationRoles.success) return invitationRoles
    const existing = repository.organizationMembershipGetByOrganizationUser(
      invitation.data.organizationId,
      parsed.output.userId,
    )
    if (!existing.success) return existing
    let membership: OrganizationMembership
    let commandIndex = 0
    if (existing.data === null) {
      const roles = organizationRolesEncode(invitationRoles.data)
      if (!roles.success) return roles
      const membershipId = uuidv7Create(runtime)
      const created = repository.organizationMembershipCreate({
        createdAt: acceptedAt,
        id: membershipId,
        realmId: invitation.data.realmId,
        organizationId: invitation.data.organizationId,
        roles: roles.data,
        updatedAt: acceptedAt,
        userId: parsed.output.userId,
        version: 1,
      })
      if (!created.success) return created
      const view = organizationMembershipPublicViewCreate(created.data)
      if (!view.success) return view
      membership = view.data
      const membershipPayload = v.safeParse(organizationMembershipEventPayloadSchema, {
        membershipId,
        roles: invitationRoles.data,
        userId: parsed.output.userId,
      })
      if (!membershipPayload.success)
        return resultErrorCodedCreate(op, "The membership event payload is invalid.", "organizations.event-invalid")
      const membershipEvent = storageEventAppend(
        transaction,
        {
          actorId: parsed.output.userId,
          aggregateId: membershipId,
          aggregateType: "organization_membership",
          aggregateVersion: 1,
          commandIndex,
          correlationId,
          eventType: organizationEventTypes.membershipAdded,
          realmId: invitation.data.realmId,
          metadata: { source: "organizations" },
          occurredAt: acceptedAt,
          payload: membershipPayload.output,
        },
        runtime,
      )
      if (!membershipEvent.success) return membershipEvent
      commandIndex += 1
    } else {
      const existingRoles = organizationRolesDecode(existing.data.roles)
      if (!existingRoles.success) return existingRoles
      const combinedRoleIds = organizationRolesNormalize([...new Set([...existingRoles.data, ...invitationRoles.data])])
      if (!combinedRoleIds.success) return combinedRoleIds
      const combinedRoles = organizationRolesEncode(combinedRoleIds.data)
      if (!combinedRoles.success) return combinedRoles
      const updated = repository.organizationMembershipUpdate(existing.data.id, {
        roles: combinedRoles.data,
        updatedAt: acceptedAt,
        version: existing.data.version + 1,
      })
      if (!updated.success) return updated
      if (updated.data === null)
        return resultErrorCodedCreate(op, "The organization membership was not found.", "organizations.not-found")
      const view = organizationMembershipPublicViewCreate(updated.data)
      if (!view.success) return view
      membership = view.data
      const membershipPayload = v.safeParse(organizationMembershipEventPayloadSchema, {
        membershipId: updated.data.id,
        roles: combinedRoleIds.data,
        userId: updated.data.userId,
      })
      if (!membershipPayload.success)
        return resultErrorCodedCreate(op, "The membership event payload is invalid.", "organizations.event-invalid")
      const membershipEvent = storageEventAppend(
        transaction,
        {
          actorId: parsed.output.userId,
          aggregateId: updated.data.id,
          aggregateType: "organization_membership",
          aggregateVersion: updated.data.version,
          commandIndex,
          correlationId,
          eventType: organizationEventTypes.membershipUpdated,
          realmId: invitation.data.realmId,
          metadata: { source: "organizations" },
          occurredAt: acceptedAt,
          payload: membershipPayload.output,
        },
        runtime,
      )
      if (!membershipEvent.success) return membershipEvent
      commandIndex += 1
    }
    const accepted = repository.organizationInvitationUpdate(invitation.data.id, {
      acceptedAt,
      status: "accepted",
      updatedAt: acceptedAt,
      version: invitation.data.version + 1,
    })
    if (!accepted.success) return accepted
    if (accepted.data === null)
      return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
    const acceptedPayload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
      invitationId: accepted.data.id,
      status: "accepted",
      userId: parsed.output.userId,
    })
    if (!acceptedPayload.success)
      return resultErrorCodedCreate(op, "The invitation event payload is invalid.", "organizations.event-invalid")
    const acceptedEvent = storageEventAppend(
      transaction,
      {
        actorId: parsed.output.userId,
        aggregateId: accepted.data.id,
        aggregateType: "organization_invitation",
        aggregateVersion: accepted.data.version,
        commandIndex,
        correlationId,
        eventType: organizationEventTypes.invitationAccepted,
        realmId: accepted.data.realmId,
        metadata: { source: "organizations" },
        occurredAt: acceptedAt,
        payload: acceptedPayload.output,
      },
      runtime,
    )
    if (!acceptedEvent.success) return acceptedEvent
    return resultCreate({ expired: false, membership })
  })
  if (!outcome.success) return outcome
  if (outcome.data.expired)
    return resultErrorCodedCreate(op, "The organization invitation has expired.", "organizations.expired")
  if (outcome.data.membership === undefined)
    return resultErrorCodedCreate(op, "The membership could not be created.", "organizations.write-failed")
  return resultCreate({ membership: outcome.data.membership })
}
