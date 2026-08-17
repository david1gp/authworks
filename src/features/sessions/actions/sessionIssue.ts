import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionCredentialCreate } from "../domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionCreatedEventPayloadSchema } from "../events/sessionCreatedEventPayloadSchema.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionAssurance } from "../public/sessionAssuranceSchema.js"
import { sessionAssuranceSchema } from "../public/sessionAssuranceSchema.js"
import type { SessionAuthenticationMethod } from "../public/sessionAuthenticationMethodSchema.js"
import { sessionAuthenticationMethodSchema } from "../public/sessionAuthenticationMethodSchema.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import { sessionDeviceMetadataSchema, type SessionDeviceMetadata } from "../public/sessionDeviceMetadataSchema.js"

type SessionIssueOptions = {
  readonly actorId?: string | null
  readonly assurance: SessionAssurance
  readonly authenticationMethod: SessionAuthenticationMethod
  readonly commandIndex?: number
  readonly correlationId?: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly database?: StorageDatabase
  readonly executor?: StorageExecutor
  readonly expiresAt?: number
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

const sessionDefaultLifetimeMs = 30 * 24 * 60 * 60 * 1_000

export function sessionIssue(options: SessionIssueOptions): Result<SessionCredentialResponse> {
  const op = "sessionIssue"
  if (options.executor === undefined && options.database !== undefined)
    return storageTransactionRun(options.database, (transaction) =>
      sessionIssue({ ...options, database: undefined, executor: transaction }),
    )
  const assurance = v.safeParse(sessionAssuranceSchema, options.assurance)
  if (!assurance.success) return resultErrorCreate(op, "The session assurance is invalid.")
  const authenticationMethod = v.safeParse(sessionAuthenticationMethodSchema, options.authenticationMethod)
  if (!authenticationMethod.success) return resultErrorCreate(op, "The session authentication method is invalid.")
  const device = v.safeParse(sessionDeviceMetadataSchema, options.deviceMetadata ?? {})
  if (!device.success) return resultErrorCreate(op, "The session device metadata is invalid.")
  if (options.instanceId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The session ownership is invalid.")
  const commandIndex = options.commandIndex ?? 0
  if (!Number.isSafeInteger(commandIndex) || commandIndex < 0)
    return resultErrorCreate(op, "The session command index is invalid.")

  const executor = options.executor ?? options.database?.db
  if (executor === undefined) return resultErrorCreate(op, "Session storage is required.")
  const runtime = options.runtime ?? options.database?.runtime ?? runtimeCreate()
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The session timestamp is invalid.")
  const expiresAt = options.expiresAt ?? now + sessionDefaultLifetimeMs
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now)
    return resultErrorCreate(op, "The session expiry is invalid.")
  const token = sessionCredentialCreate(runtime)
  if (token.length < 43) return resultErrorCreate(op, "The session credential could not be created.")
  const sessionId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const deviceData = device.output
  const repository = sessionRepositoryCreate(executor)
  const created = repository.sessionCreate({
    assurance: assurance.output,
    authenticationMethod: authenticationMethod.output,
    createdAt: now,
    deviceDescription: deviceData.description ?? null,
    deviceFingerprint: deviceData.fingerprint ?? null,
    expiresAt,
    id: sessionId,
    instanceId: options.instanceId,
    ipAddress: deviceData.ipAddress ?? null,
    lastUsedAt: now,
    revokedAt: null,
    revocationReason: null,
    tokenHash: sessionCredentialHashCreate(token),
    userAgent: deviceData.userAgent ?? null,
    userId: options.userId,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(sessionCreatedEventPayloadSchema, {
    assurance: assurance.output,
    authenticationMethod: authenticationMethod.output,
    device: deviceData,
    expiresAt,
    sessionId,
    userId: options.userId,
  })
  if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.")
  const event = storageEventAppend(
    executor,
    {
      actorId: options.actorId,
      aggregateId: sessionId,
      aggregateType: "session",
      aggregateVersion: 1,
      commandIndex,
      correlationId,
      eventType: sessionEventTypes.created,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: now,
      payload: payload.output,
    },
    runtime,
  )
  if (!event.success) return event
  return resultCreate({ session: sessionPublicViewCreate(created.data, true), token })
}
