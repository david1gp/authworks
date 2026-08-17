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
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailVerificationChangedEventPayloadSchema } from "../events/userEmailVerificationChangedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { type UserVerificationRequest, userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserEmailVerificationSetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: UserVerificationRequest
  readonly instanceId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userEmailVerificationSet(options: UserEmailVerificationSetOptions): Result<{ user: User }> {
  const op = "userEmailVerificationSet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The user is not available in this tenant context.")
  const parsed = v.safeParse(userVerificationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user verification request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) return resultErrorCreate(op, "The user timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.instanceId, options.userId)
    if (!current.success) return current
    if (current.data === null || current.data.state === "deleted")
      return resultErrorCreate(op, "The user was not found.")
    const currentlyVerified = current.data.emailVerifiedAt !== null
    const requestedVerified = parsed.output.state === "verified"
    if (currentlyVerified === requestedVerified)
      return resultErrorCreate(op, "The user already has that verification state.")
    const updated = repository.userUpdate(options.instanceId, options.userId, {
      emailVerifiedAt: requestedVerified ? updatedAt : null,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The user was not found.")
    const payload = v.safeParse(userEmailVerificationChangedEventPayloadSchema, { state: parsed.output.state })
    if (!payload.success) return resultErrorCreate(op, "The user verification event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.emailVerificationChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ user: userPublicViewCreate(updated.data) })
  })
}
