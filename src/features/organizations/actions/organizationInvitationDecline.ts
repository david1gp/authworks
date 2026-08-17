import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationInvitationTokenHashCreate } from "../domain/organizationInvitationTokenHashCreate.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationInvitationStatusEventPayloadSchema } from "../events/organizationInvitationStatusEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationInvitationAcceptRequest,
  organizationInvitationAcceptRequestSchema,
} from "../public/organizationInvitationAcceptRequestSchema.js"

type OrganizationInvitationDeclineOptions = {
  readonly database: StorageDatabase
  readonly input: OrganizationInvitationAcceptRequest
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationInvitationDecline(
  options: OrganizationInvitationDeclineOptions,
): Result<{ declined: true }> {
  const op = "organizationInvitationDecline"
  const parsed = v.safeParse(organizationInvitationAcceptRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The organization invitation decline is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const declinedAt = runtime.now()
  if (!Number.isSafeInteger(declinedAt) || declinedAt < 0)
    return resultErrorCreate(op, "The invitation timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const invitation = repository.organizationInvitationGetByTokenHash(
      organizationInvitationTokenHashCreate(parsed.output.token),
    )
    if (!invitation.success) return invitation
    if (invitation.data === null || invitation.data.status !== "pending")
      return resultErrorCreate(op, "The organization invitation is no longer pending.")
    if (declinedAt >= invitation.data.expiresAt)
      return resultErrorCreate(op, "The organization invitation has expired.")
    const updated = repository.organizationInvitationUpdate(invitation.data.id, {
      status: "declined",
      updatedAt: declinedAt,
      version: invitation.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The organization invitation was not found.")
    const payload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
      invitationId: updated.data.id,
      status: "declined",
      userId: parsed.output.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The invitation event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: parsed.output.userId,
        aggregateId: updated.data.id,
        aggregateType: "organization_invitation",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.invitationDeclined,
        instanceId: updated.data.instanceId,
        metadata: { source: "organizations" },
        occurredAt: declinedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ declined: true as const })
  })
}
