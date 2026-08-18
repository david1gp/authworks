import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaChallengeViewCreate } from "../domain/mfaChallengeViewCreate.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"

type MfaLoginChallengeStartOptions = {
  readonly actorId?: string | null
  readonly database?: StorageDatabase
  readonly deviceMetadata?: {
    readonly description?: string
    readonly fingerprint?: string
    readonly ipAddress?: string
    readonly userAgent?: string
  }
  readonly executor?: StorageExecutor
  readonly realmId: string
  readonly primaryAuthenticationMethod?: SessionAuthenticationMethod
  readonly purpose: "login" | "step_up"
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId?: string
  readonly userId: string
  readonly correlationId?: string
}

export function mfaLoginChallengeStart(options: MfaLoginChallengeStartOptions): Result<MfaChallengeResponse> {
  const op = "mfaLoginChallengeStart"
  if (options.database !== undefined && options.executor === undefined) {
    const runtime = options.runtime ?? options.database.runtime
    return storageTransactionRun(options.database, (transaction) =>
      mfaLoginChallengeStart({ ...options, database: undefined, executor: transaction, runtime }),
    )
  }
  if (options.purpose === "step_up" && options.sessionId === undefined)
    return resultErrorCreate(op, "The MFA session is required.", "mfa.unauthorized")
  const executor = options.executor ?? options.database?.db
  if (executor === undefined) return resultErrorCreate(op, "MFA storage is required.", "mfa.invalid")
  const runtime = options.runtime ?? options.database?.runtime ?? runtimeCreate()
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The MFA challenge timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return mfaLoginChallengeStartTransaction({ ...options, correlationId, executor, now, runtime })
}

type MfaLoginChallengeStartTransactionOptions = {
  readonly actorId?: string | null
  readonly correlationId: string
  readonly deviceMetadata?: MfaLoginChallengeStartOptions["deviceMetadata"]
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly now: number
  readonly primaryAuthenticationMethod?: SessionAuthenticationMethod
  readonly purpose: "login" | "step_up"
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId?: string
  readonly userId: string
}

function mfaLoginChallengeStartTransaction(
  options: MfaLoginChallengeStartTransactionOptions,
): Result<MfaChallengeResponse> {
  const repository = mfaRepositoryCreate(options.executor)
  const policyRow = repository.mfaPolicyGet(options.realmId)
  if (!policyRow.success) return policyRow
  const policy = policyRow.data ?? {
    ...mfaPolicyDefaults,
    lockoutDurationMs: mfaPolicyDefaults.lockoutDurationMs,
    maxAttempts: mfaPolicyDefaults.maxAttempts,
    totpWindow: mfaPolicyDefaults.totpWindow,
  }
  const active = repository.mfaEnrollmentActiveGet(options.realmId, options.userId)
  if (!active.success) return active
  if (active.data === null)
    return resultErrorCreate("mfaLoginChallengeStart", "An active TOTP enrollment is required.", "mfa.not-found")
  let primaryAuthenticationMethod = options.primaryAuthenticationMethod
  if (options.purpose === "step_up") {
    const session = options.executor
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, options.realmId),
          eq(sessionTable.id, options.sessionId!),
          eq(sessionTable.userId, options.userId),
        ),
      )
      .get()
    if (
      session === undefined ||
      session.revokedAt !== null ||
      session.expiresAt <= options.now ||
      session.assurance === "none"
    )
      return resultErrorCreate("mfaLoginChallengeStart", "The MFA session is invalid.", "mfa.unauthorized")
    primaryAuthenticationMethod = session.authenticationMethod as SessionAuthenticationMethod
  }
  if (
    primaryAuthenticationMethod === undefined ||
    !["email_otp", "external_identity", "password", "passkey"].includes(primaryAuthenticationMethod)
  )
    return resultErrorCreate("mfaLoginChallengeStart", "The primary authentication method is invalid.", "mfa.invalid")
  const tokenBytes = options.runtime.randomBytes(32)
  const token = Buffer.from(tokenBytes).toString("base64url")
  const challengeId = uuidv7Create(options.runtime)
  const expiresAt = options.now + 5 * 60 * 1_000
  const created = repository.mfaChallengeCreate({
    attempts: 0,
    consumedAt: null,
    createdAt: options.now,
    deviceDescription: options.deviceMetadata?.description ?? null,
    deviceFingerprint: options.deviceMetadata?.fingerprint ?? null,
    expiresAt,
    id: challengeId,
    realmId: options.realmId,
    ipAddress: options.deviceMetadata?.ipAddress ?? null,
    maxAttempts: policy.maxAttempts,
    primaryAuthenticationMethod,
    purpose: options.purpose,
    requiredAssurance: "multi_factor",
    sessionId: options.sessionId ?? null,
    tokenHash: mfaChallengeTokenHashCreate(token),
    userAgent: options.deviceMetadata?.userAgent ?? null,
    userId: options.userId,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(mfaEventPayloadSchema, { challengeId, purpose: options.purpose, userId: options.userId })
  if (!payload.success)
    return resultErrorCreate("mfaLoginChallengeStart", "The MFA event payload is invalid.", "mfa.event-invalid")
  const event = storageEventAppend(
    options.executor,
    {
      actorId: options.actorId ?? options.userId,
      aggregateId: challengeId,
      aggregateType: "mfa_challenge",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: mfaEventTypes.challengeStarted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ challenge: mfaChallengeViewCreate(created.data), token })
}
