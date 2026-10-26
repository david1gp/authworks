import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userMetadataSetEventPayloadSchema } from "../events/userMetadataSetEventPayloadSchema.js"
import { userMetadataRepositoryCreate } from "../persistence/userMetadataRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userMetadataKeySchema } from "../public/userMetadataKeySchema.js"
import type { UserMetadata } from "../public/userMetadataSchema.js"
import { type UserMetadataSetRequest, userMetadataSetRequestSchema } from "../public/userMetadataSetRequestSchema.js"
import { userMetadataAuthorize } from "./userMetadataAuthorize.js"

const userMetadataMaximumEntries = 50

type UserMetadataSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserMetadataSetRequest
  readonly key: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function userMetadataSet(options: UserMetadataSetOptions): Result<{ metadata: UserMetadata }> {
  const op = "userMetadataSet"
  if (!v.safeParse(userMetadataKeySchema, options.key).success)
    return resultErrorCreate(op, "The metadata key is invalid.", "users.invalid")
  const parsed = v.safeParse(userMetadataSetRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user metadata is invalid.", "users.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted")
    return resultErrorCreate(op, "The user was not found.", "users.not-found")
  const authorized = userMetadataAuthorize({
    allowSelfRead: false,
    context: options.context,
    database: options.database,
    permission: "user.manage",
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The metadata timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = userMetadataRepositoryCreate(transaction)
    const current = repository.userMetadataGet(options.realmId, options.userId, options.key)
    if (!current.success) return current
    if (current.data === null) {
      const count = repository.userMetadataCount(options.realmId, options.userId)
      if (!count.success) return count
      if (count.data >= userMetadataMaximumEntries)
        return resultErrorCreate(op, "The user metadata limit was reached.", "users.metadata-limit")
    }
    const version = (current.data?.version ?? 0) + 1
    const saved = repository.userMetadataUpsert({
      createdAt: current.data?.createdAt ?? now,
      key: options.key,
      realmId: options.realmId,
      updatedAt: now,
      userId: options.userId,
      value: parsed.output.value,
      version,
    })
    if (!saved.success) return saved
    const payload = v.safeParse(userMetadataSetEventPayloadSchema, {
      key: options.key,
      userId: options.userId,
      version,
    })
    if (!payload.success) return resultErrorCreate(op, "The metadata event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user_metadata",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.metadataSet,
        metadata: { source: "users" },
        occurredAt: now,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      metadata: {
        createdAt: saved.data.createdAt,
        key: saved.data.key,
        updatedAt: saved.data.updatedAt,
        userId: saved.data.userId,
        value: saved.data.value,
        version: saved.data.version,
      },
    })
  })
}
