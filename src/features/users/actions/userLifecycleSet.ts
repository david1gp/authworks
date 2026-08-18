import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import type { UserState } from "../domain/userStateSchema.js"
import { userStateTransitionAllowed } from "../domain/userStateTransitionAllowed.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userStateChangedEventPayloadSchema } from "../events/userStateChangedEventPayloadSchema.js"
import { type UserLifecycleRequest, userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserLifecycleSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserLifecycleRequest
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userLifecycleSet(options: UserLifecycleSetOptions): Result<{ user: User }> {
  const op = "userLifecycleSet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.")
  const parsed = v.safeParse(userLifecycleRequestSchema, options.input)
  if (!parsed.success || parsed.output.state === "deleted")
    return resultErrorCreate(op, "The user lifecycle request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) return resultErrorCreate(op, "The user timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.realmId, options.userId)
    if (!current.success) return current
    if (current.data === null || current.data.state === "deleted")
      return resultErrorCreate(op, "The user was not found.")
    if (!userStateTransitionAllowed(current.data.state as UserState, parsed.output.state))
      return resultErrorCreate(op, "The user lifecycle transition is not allowed.")
    const updated = repository.userUpdate(options.realmId, options.userId, {
      state: parsed.output.state,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The user was not found.")
    const payload = v.safeParse(userStateChangedEventPayloadSchema, {
      from: current.data.state,
      to: updated.data.state,
    })
    if (!payload.success) return resultErrorCreate(op, "The user lifecycle event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.stateChanged,
        realmId: options.realmId,
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
