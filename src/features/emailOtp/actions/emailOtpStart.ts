import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { emailOtpCodeCreate } from "../domain/emailOtpCodeCreate.js"
import { emailOtpCodeHashCreate } from "../domain/emailOtpCodeHashCreate.js"
import { emailOtpEmailHashCreate } from "../domain/emailOtpEmailHashCreate.js"
import { emailOtpEventTypes } from "../events/emailOtpEventTypes.js"
import { emailOtpRequestedEventPayloadSchema } from "../events/emailOtpRequestedEventPayloadSchema.js"
import { emailOtpRepositoryCreate } from "../persistence/emailOtpRepositoryCreate.js"
import type { EmailOtpDelivery } from "../public/emailOtpDeliverySchema.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
import type { EmailOtpStartRequest } from "../public/emailOtpStartRequestSchema.js"
import { emailOtpStartRequestSchema } from "../public/emailOtpStartRequestSchema.js"
import type { EmailOtpStartResponse } from "../public/emailOtpStartResponseSchema.js"

const emailOtpCooldownMs = 60 * 1_000
const emailOtpExpiryMs = 10 * 60 * 1_000
const emailOtpMaxAttempts = 5

type EmailOtpStartOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: EmailOtpStartRequest
  readonly realmId: string
  readonly organizationId?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly onDelivery?: (delivery: EmailOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: EmailOtpSecurityNotification) => void | Promise<void>
}

type EmailOtpStartCommit = {
  readonly response: EmailOtpStartResponse
  readonly delivery?: EmailOtpDelivery
  readonly notification?: EmailOtpSecurityNotification
}

export function emailOtpStart(options: EmailOtpStartOptions): Result<EmailOtpStartResponse> {
  const op = "emailOtpStart"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "email-otp.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The email OTP is not available in this tenant context.", "email-otp.not-found")
  const parsed = v.safeParse(emailOtpStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email OTP request is invalid.", "email-otp.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email OTP timestamp is invalid.", "email-otp.invalid")
  const generic = () =>
    resultCreate<EmailOtpStartResponse>({
      accepted: true,
      challengeId: uuidv7Create(runtime),
      expiresAt: now + emailOtpExpiryMs,
      retryAt: now + emailOtpCooldownMs,
    })
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return generic()
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active") return generic()
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "email_otp",
    organizationId: options.organizationId ?? parsed.output.organizationId,
  })
  if (!policy.success)
    return resultErrorCreate(op, "The email OTP login method is disabled for this organization.", "email-otp.conflict")
  const emailHash = emailOtpEmailHashCreate(email.data)
  const code = emailOtpCodeCreate(runtime)
  if (!code.success) return code
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) => {
    const repository = emailOtpRepositoryCreate(transaction)
    const latest = repository.emailOtpChallengeLatestGet(options.realmId, emailHash, "sign_in")
    if (!latest.success) return latest
    if (latest.data !== null && latest.data.cooldownUntil > now) {
      return resultCreate<EmailOtpStartCommit>({
        response: {
          accepted: true,
          challengeId: latest.data.id,
          expiresAt: latest.data.expiresAt,
          retryAt: latest.data.cooldownUntil,
        },
      })
    }
    const previous = repository.emailOtpChallengeExpirePrevious(options.realmId, emailHash, "sign_in", now)
    if (!previous.success) return previous
    const user = repository.emailOtpUserFindByEmail(options.realmId, email.data)
    if (!user.success) return user
    const eligible =
      user.data !== null &&
      user.data.state === "active" &&
      user.data.deletedAt === null &&
      user.data.emailVerifiedAt !== null
    const expiresAt = now + emailOtpExpiryMs
    const cooldownUntil = now + emailOtpCooldownMs
    const created = repository.emailOtpChallengeCreate({
      attempts: 0,
      codeHash: emailOtpCodeHashCreate(challengeId, eligible ? code.data : `${code.data}decoy`),
      consumedAt: null,
      cooldownUntil,
      createdAt: now,
      emailHash,
      expiresAt,
      id: challengeId,
      realmId: options.realmId,
      maxAttempts: emailOtpMaxAttempts,
      organizationId: options.organizationId ?? parsed.output.organizationId ?? null,
      purpose: "sign_in",
      userId: eligible && user.data !== null ? user.data.id : null,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(emailOtpRequestedEventPayloadSchema, {
      challengeId,
      expiresAt,
      purpose: "sign_in",
    })
    if (!payload.success) return resultErrorCreate(op, "The email OTP event payload is invalid.", "email-otp.internal")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: challengeId,
        aggregateType: "email_otp",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: emailOtpEventTypes.requested,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "email_otp" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    if (!eligible || user.data === null) {
      return resultCreate<EmailOtpStartCommit>({
        response: { accepted: true, challengeId, expiresAt, retryAt: cooldownUntil },
      })
    }
    return resultCreate<EmailOtpStartCommit>({
      delivery: {
        challengeId,
        code: code.data,
        email: email.data,
        expiresAt,
        realmId: options.realmId,
        purpose: "sign_in",
        userId: user.data.id,
      },
      notification: { challengeId, realmId: options.realmId, kind: "requested", userId: user.data.id },
      response: { accepted: true, challengeId, expiresAt, retryAt: cooldownUntil },
    })
  })
  if (!committed.success) return committed
  if (committed.data.delivery !== undefined) emailOtpPortInvoke(options.onDelivery, committed.data.delivery)
  if (committed.data.notification !== undefined)
    emailOtpPortInvoke(options.onSecurityNotification, committed.data.notification)
  return resultCreate(committed.data.response)
}

function emailOtpPortInvoke<T>(port: ((value: T) => void | Promise<void>) | undefined, value: T): void {
  if (port === undefined) return
  try {
    void Promise.resolve(port(value)).catch(() => undefined)
  } catch (_error) {}
}
