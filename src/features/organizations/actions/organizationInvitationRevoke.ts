import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationInvitationStatusEventPayloadSchema } from "../events/organizationInvitationStatusEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationInvitationRevokeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly invitationId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationInvitationRevoke(options: OrganizationInvitationRevokeOptions): Result<{ revoked: true }> {
  const op = "organizationInvitationRevoke"
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The invitation timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const invitation = repository.organizationInvitationGet(options.invitationId)
    if (!invitation.success) return invitation
    if (
      invitation.data === null ||
      invitation.data.instanceId !== options.instanceId ||
      invitation.data.organizationId !== options.organizationId
    )
      return resultErrorCreate(op, "The organization invitation was not found.")
    const organization = repository.organizationGet(invitation.data.organizationId)
    if (!organization.success) return organization
    if (organization.data === null || organization.data.status === "removed")
      return resultErrorCreate(op, "The organization was not found.")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository,
      requiredRole: "admin",
    })
    if (!authorized.success) return authorized
    if (invitation.data.status !== "pending")
      return resultErrorCreate(op, "The organization invitation is not pending.")
    const updated = repository.organizationInvitationUpdate(options.invitationId, {
      status: "revoked",
      updatedAt,
      version: invitation.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The organization invitation was not found.")
    const payload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
      invitationId: updated.data.id,
      status: "revoked",
    })
    if (!payload.success) return resultErrorCreate(op, "The invitation event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: updated.data.id,
        aggregateType: "organization_invitation",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.invitationRevoked,
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ revoked: true as const })
  })
}
