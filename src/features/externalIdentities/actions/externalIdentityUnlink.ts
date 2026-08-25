import { and, count, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { passkeyUsableAuthenticationMethodRead } from "../../passkeys/server/passkeyUsableAuthenticationMethodRead.js"
import { passwordUsableAuthenticationMethodRead } from "../../passwords/server/passwordUsableAuthenticationMethodRead.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import { externalIdentityTable } from "../persistence/externalIdentityTable.js"
import type { ExternalIdentityUnlinkResponse } from "../public/externalIdentityUnlinkResponseSchema.js"

type ExternalIdentityUnlinkOptions = {
  readonly database: StorageDatabase
  readonly externalSubject: string
  readonly realmId: string
  readonly providerId: string
  readonly session: Session
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

const externalIdentityRecentAuthenticationMs = 5 * 60 * 1_000

export function externalIdentityUnlink(options: ExternalIdentityUnlinkOptions): Result<ExternalIdentityUnlinkResponse> {
  const op = "externalIdentityUnlink"
  if (
    options.session.realmId !== options.realmId ||
    options.session.subjectType !== "user" ||
    options.session.subjectId !== options.userId
  )
    return resultErrorCreate(op, "The session does not belong to this user.", "external-identities.forbidden")
  if (options.session.assurance === "none")
    return resultErrorCreate(op, "Session authorization is required.", "external-identities.unauthorized")
  if (options.externalSubject.length === 0 || options.providerId.length === 0)
    return resultErrorCreate(op, "The external identity is invalid.", "external-identities.invalid")
  const identity = externalIdentityRepositoryCreate(options.database.db).externalIdentityList(
    options.realmId,
    options.userId,
  )
  if (!identity.success) return identity
  const selected = identity.data.find(
    (candidate) => candidate.providerId === options.providerId && candidate.externalSubject === options.externalSubject,
  )
  if (selected === undefined)
    return resultErrorCreate(op, "The external identity was not found.", "external-identities.not-found")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The external identity timestamp is invalid.", "external-identities.invalid-timestamp")
  if (now < options.session.createdAt || now - options.session.createdAt > externalIdentityRecentAuthenticationMs)
    return resultErrorCreate(
      op,
      "A recent authentication is required before removing an external identity.",
      "external-identities.unauthorized",
    )
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = externalIdentityRepositoryCreate(transaction)
    const others = transaction
      .select({ total: count() })
      .from(externalIdentityTable)
      .where(and(eq(externalIdentityTable.realmId, options.realmId), eq(externalIdentityTable.userId, options.userId)))
      .get()
    const password = passwordUsableAuthenticationMethodRead({
      executor: transaction,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!password.success) return password
    const passkeys = passkeyUsableAuthenticationMethodRead({
      executor: transaction,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!passkeys.success) return passkeys
    if ((others?.total ?? 0) <= 1 && !password.data.available && !passkeys.data.available)
      return resultErrorCreate(
        op,
        "The last usable authentication method cannot be removed.",
        "external-identities.conflict",
      )
    const removed = repository.externalIdentityDelete(
      options.realmId,
      options.userId,
      options.providerId,
      options.externalSubject,
    )
    if (!removed.success) return removed
    if (removed.data === null)
      return resultErrorCreate(op, "The external identity was not found.", "external-identities.not-found")
    const version = repository.externalIdentityEventVersionGet(removed.data.id)
    if (!version.success) return version
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "unlinked",
      externalSubject: removed.data.externalSubject,
      identityId: removed.data.id,
      providerId: removed.data.providerId,
      userId: options.userId,
    })
    if (!payload.success)
      return resultErrorCreate(
        op,
        "The external identity event payload is invalid.",
        "external-identities.event-invalid",
      )
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
        realmId: options.realmId,
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
