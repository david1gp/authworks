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
  readonly subject?: {
    readonly email: string
    readonly realmId: string
    readonly userId: string
  }
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationInvitationDecline(
  options: OrganizationInvitationDeclineOptions,
): Result<{ declined: true }> {
  const op = "organizationInvitationDecline"
  const parsed = v.safeParse(organizationInvitationAcceptRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization invitation decline is invalid.", "organizations.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const declinedAt = runtime.now()
  if (!Number.isSafeInteger(declinedAt) || declinedAt < 0)
    return resultErrorCodedCreate(op, "The invitation timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const invitation = repository.organizationInvitationGetByTokenHash(
      organizationInvitationTokenHashCreate(parsed.output.token),
    )
    if (!invitation.success) return invitation
    if (
      invitation.data === null ||
      (options.subject !== undefined &&
        (parsed.output.userId !== options.subject.userId ||
          invitation.data.realmId !== options.subject.realmId ||
          invitation.data.email !== options.subject.email))
    )
      return resultErrorCodedCreate(op, "The organization invitation is invalid.", "organizations.not-found")
    if (invitation.data.status !== "pending")
      return resultErrorCodedCreate(op, "The organization invitation is no longer pending.", "organizations.pending")
    if (declinedAt >= invitation.data.expiresAt)
      return resultErrorCodedCreate(op, "The organization invitation has expired.", "organizations.expired")
    const updated = repository.organizationInvitationUpdate(invitation.data.id, {
      status: "declined",
      updatedAt: declinedAt,
      version: invitation.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The organization invitation was not found.", "organizations.not-found")
    const payload = v.safeParse(organizationInvitationStatusEventPayloadSchema, {
      invitationId: updated.data.id,
      status: "declined",
      userId: parsed.output.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The invitation event payload is invalid.", "organizations.event-invalid")
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
        realmId: updated.data.realmId,
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
