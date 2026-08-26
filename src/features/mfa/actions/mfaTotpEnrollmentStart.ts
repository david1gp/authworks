import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userTable } from "../../users/persistence/userTable.js"
import { mfaTotpEnrollmentViewCreate } from "../domain/mfaTotpEnrollmentViewCreate.js"
import { mfaTotpSecretCreate } from "../domain/mfaTotpSecretCreate.js"
import { mfaTotpSecretProtect } from "../domain/mfaTotpSecretProtect.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaTotpEnrollmentStartRequest } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import { mfaTotpEnrollmentStartRequestSchema } from "../public/mfaTotpEnrollmentStartRequestSchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../public/mfaTotpEnrollmentStartResponseSchema.js"

type MfaTotpEnrollmentStartOptions = {
  readonly actorId?: string | null
  readonly database?: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly executor?: StorageTransaction
  readonly input?: MfaTotpEnrollmentStartRequest
  readonly realmId: string
  readonly label?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
  readonly issuer?: string
}

export function mfaTotpEnrollmentStart(options: MfaTotpEnrollmentStartOptions): Result<MfaTotpEnrollmentStartResponse> {
  const op = "mfaTotpEnrollmentStart"
  const realm =
    options.database === undefined
      ? null
      : realmGet({
          context: realmSystemContextCreate(),
          database: options.database,
          realmId: options.realmId,
        })
  if (options.database !== undefined && options.executor === undefined) {
    if (realm === null || !realm.success || realm.data.realm.status !== "active")
      return resultErrorCreate(op, "The TOTP enrollment is invalid.", "mfa.invalid")
    const issuer = realm.data.realm.domain
    const runtime = options.runtime ?? options.database.runtime
    return storageTransactionRun(options.database, (transaction) =>
      mfaTotpEnrollmentStart({ ...options, database: undefined, executor: transaction, issuer, runtime }),
    )
  }
  const input = v.safeParse(mfaTotpEnrollmentStartRequestSchema, options.input ?? { label: options.label })
  if (!input.success) return resultErrorCreate(op, "The TOTP enrollment request is invalid.", "mfa.invalid")
  const executor = options.executor
  if (executor === undefined) return resultErrorCreate(op, "MFA storage is required.", "mfa.invalid")
  const runtime = options.runtime ?? options.database?.runtime ?? runtimeCreate()
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The TOTP enrollment timestamp is invalid.", "mfa.invalid-timestamp")
  if (realm !== null && (!realm.success || realm.data.realm.status !== "active"))
    return resultErrorCreate(op, "The TOTP enrollment is invalid.", "mfa.invalid")
  const secret = mfaTotpSecretCreate(runtime)
  if (!secret.success) return secret
  const protectedSecret = mfaTotpSecretProtect("encrypt", secret.data, options.realmId, options.encryptionSecret)
  if (!protectedSecret.success) return protectedSecret
  const enrollmentId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const repository = mfaRepositoryCreate(executor)
  const foundUser = executor
    .select({ id: userTable.id, state: userTable.state })
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, options.userId)))
    .get()
  if (foundUser === undefined || foundUser.state !== "active")
    return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
  const pending = repository.mfaEnrollmentPendingDelete(options.realmId, options.userId)
  if (!pending.success) return pending
  const created = repository.mfaEnrollmentCreate({
    confirmedAt: null,
    createdAt: now,
    encryptedSecret: protectedSecret.data,
    id: enrollmentId,
    realmId: options.realmId,
    label: input.output.label ?? "Authenticator app",
    lastUsedStep: null,
    status: "pending",
    userId: options.userId,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(mfaEventPayloadSchema, { enrollmentId, userId: options.userId })
  if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
  const event = eventSecurityEventAppend(
    executor,
    {
      actorId: options.actorId,
      aggregateId: enrollmentId,
      aggregateType: "mfa_totp_enrollment",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId,
      eventType: mfaEventTypes.totpEnrollmentStarted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: now,
      payload: payload.output,
      userSubjectId: options.userId,
    },
    runtime,
  )
  if (!event.success) return event
  const issuer = options.issuer ?? (realm?.success ? realm.data.realm.domain : options.realmId)
  const account = encodeURIComponent(options.userId)
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${account}?secret=${secret.data}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  return resultCreate({ enrollment: mfaTotpEnrollmentViewCreate(created.data), otpauthUri, secret: secret.data })
}
