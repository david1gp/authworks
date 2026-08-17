import * as v from "valibot"
import { and, eq, count } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { passwordCredentialTable } from "../../passwords/persistence/passwordCredentialTable.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import { externalIdentityTable } from "../persistence/externalIdentityTable.js"
import type { ExternalIdentityUnlinkResponse } from "../public/externalIdentityUnlinkResponseSchema.js"

type ExternalIdentityUnlinkOptions = {
  readonly database: StorageDatabase
  readonly externalSubject: string
  readonly instanceId: string
  readonly providerId: string
  readonly session: Session
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityUnlink(options: ExternalIdentityUnlinkOptions): Result<ExternalIdentityUnlinkResponse> {
  const op = "externalIdentityUnlink"
  if (options.session.instanceId !== options.instanceId || options.session.userId !== options.userId)
    return resultErrorCreate(op, "The session does not belong to this user.")
  if (options.session.assurance === "none") return resultErrorCreate(op, "Session authorization is required.")
  if (options.externalSubject.length === 0 || options.providerId.length === 0)
    return resultErrorCreate(op, "The external identity is invalid.")
  const identity = externalIdentityRepositoryCreate(options.database.db).externalIdentityList(
    options.instanceId,
    options.userId,
  )
  if (!identity.success) return identity
  const selected = identity.data.find(
    (candidate) => candidate.providerId === options.providerId && candidate.externalSubject === options.externalSubject,
  )
  if (selected === undefined) return resultErrorCreate(op, "The external identity was not found.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The external identity timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = externalIdentityRepositoryCreate(transaction)
    const others = transaction
      .select({ total: count() })
      .from(externalIdentityTable)
      .where(
        and(eq(externalIdentityTable.instanceId, options.instanceId), eq(externalIdentityTable.userId, options.userId)),
      )
      .get()
    const password = transaction
      .select({ id: passwordCredentialTable.userId })
      .from(passwordCredentialTable)
      .where(
        and(
          eq(passwordCredentialTable.instanceId, options.instanceId),
          eq(passwordCredentialTable.userId, options.userId),
        ),
      )
      .get()
    if ((others?.total ?? 0) <= 1 && password === undefined)
      return resultErrorCreate(op, "The last usable authentication method cannot be removed.")
    const removed = repository.externalIdentityDelete(
      options.instanceId,
      options.userId,
      options.providerId,
      options.externalSubject,
    )
    if (!removed.success) return removed
    if (removed.data === null) return resultErrorCreate(op, "The external identity was not found.")
    const version = repository.externalIdentityEventVersionGet(removed.data.id)
    if (!version.success) return version
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "unlinked",
      externalSubject: removed.data.externalSubject,
      identityId: removed.data.id,
      providerId: removed.data.providerId,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The external identity event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.userId,
        aggregateId: removed.data.id,
        aggregateType: "external_identity",
        aggregateVersion: version.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: externalIdentityEventTypes.unlinked,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true })
  })
}
