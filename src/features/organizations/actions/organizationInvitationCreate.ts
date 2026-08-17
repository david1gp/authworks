import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { secretGenerate } from "../../../platform/secrets/secretGenerate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationEmailNormalize } from "../domain/organizationEmailNormalize.js"
import { organizationInvitationPublicViewCreate } from "../domain/organizationInvitationPublicViewCreate.js"
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
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationInvitationCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationInvitationCreateRequest
  readonly instanceId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationInvitationCreate(
  options: OrganizationInvitationCreateOptions,
): Result<OrganizationInvitationCreateResponse> {
  const op = "organizationInvitationCreate"
  const parsed = v.safeParse(organizationInvitationCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The organization invitation request is invalid.")
  const email = organizationEmailNormalize(parsed.output.email)
  if (!email.success) return email
  const roles = organizationRolesEncode(parsed.output.roles)
  if (!roles.success) return roles
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The invitation timestamp is invalid.")
  const expiresAt = parsed.output.expiresAt ?? createdAt + 7 * 24 * 60 * 60 * 1000
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= createdAt)
    return resultErrorCreate(op, "The invitation expiry is invalid.")
  const token = secretGenerate(32, runtime)
  const invitationId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const organization = repository.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.instanceId !== options.instanceId ||
      organization.data.status !== "active"
    )
      return resultErrorCreate(op, "The organization is not active or was not found.")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository,
      requiredPermission: "organization.members.manage",
    })
    if (!authorized.success) return authorized

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
      if (revoked.data === null) return resultErrorCreate(op, "The previous invitation was not found.")
      const revokePayload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
        invitationId: revoked.data.id,
        status: "revoked",
      })
      if (!revokePayload.success) return resultErrorCreate(op, "The invitation event payload is invalid.")
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
          instanceId: options.instanceId,
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
      instanceId: options.instanceId,
      invitedBy: options.context.actorId,
      organizationId: options.organizationId,
      roles: roles.data,
      status: "pending",
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
    if (!payload.success) return resultErrorCreate(op, "The invitation event payload is invalid.")
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
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = organizationInvitationPublicViewCreate(invitation.data)
    if (!view.success) return view
    return resultCreate({ invitation: view.data, token: token.valueGet() })
  })
}
