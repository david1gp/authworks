import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"
import { organizationMembershipContextValidate } from "../../organizations/server/organizationMembershipContextValidate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaChallengeViewCreate } from "../domain/mfaChallengeViewCreate.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import type { MfaPolicyFactor } from "../public/mfaPolicyFactorSchema.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

type MfaLoginChallengeStartOptions = {
  readonly actorId?: string | null
  readonly database?: StorageDatabase
  readonly deviceMetadata?: {
    readonly description?: string
    readonly fingerprint?: string
    readonly ipAddress?: string
    readonly userAgent?: string
  }
  readonly executor?: StorageTransaction
  readonly factor?: MfaPolicyFactor
  readonly organizationId?: string
  readonly policyDatabase?: StorageDatabase
  readonly realmId: string
  readonly primaryAuthenticationMethod?: SessionAuthenticationMethod
  readonly purpose: "login" | "step_up"
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
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
  const executor = options.executor
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
  readonly executor: StorageTransaction
  readonly factor?: MfaPolicyFactor
  readonly organizationId?: string
  readonly policyDatabase?: StorageDatabase
  readonly realmId: string
  readonly now: number
  readonly primaryAuthenticationMethod?: SessionAuthenticationMethod
  readonly purpose: "login" | "step_up"
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
  readonly sessionId?: string
  readonly userId: string
}

function mfaLoginChallengeStartTransaction(
  options: MfaLoginChallengeStartTransactionOptions,
): Result<MfaChallengeResponse> {
  const repository = mfaRepositoryCreate(options.executor)
  const policyRow = repository.mfaPolicyGet(options.realmId)
  if (!policyRow.success) return policyRow
  const legacyPolicy = policyRow.data ?? {
    ...mfaPolicyDefaults,
    lockoutDurationMs: mfaPolicyDefaults.lockoutDurationMs,
    maxAttempts: mfaPolicyDefaults.maxAttempts,
    totpWindow: mfaPolicyDefaults.totpWindow,
  }
  let primaryAuthenticationMethod = options.primaryAuthenticationMethod
  let organizationId = options.organizationId
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
    if (options.organizationId !== undefined && options.organizationId !== session.organizationId)
      return resultErrorCreate("mfaLoginChallengeStart", "The MFA session is invalid.", "mfa.unauthorized")
    organizationId = session.organizationId ?? undefined
  }
  const loginContext = organizationLoginContextResolve({
    executor: options.executor,
    organizationId,
    realmId: options.realmId,
  })
  if (!loginContext.success)
    return resultErrorCreate("mfaLoginChallengeStart", "The MFA context is invalid.", "mfa.unauthorized")
  organizationId = loginContext.data.organizationId
  if (options.purpose === "step_up" && organizationId !== undefined) {
    const membership = organizationMembershipContextValidate({
      executor: options.executor,
      organizationId,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!membership.success)
      return resultErrorCreate("mfaLoginChallengeStart", "The MFA session is unauthorized.", "mfa.unauthorized")
  }
  if (
    primaryAuthenticationMethod === undefined ||
    !["email_otp", "external_identity", "password", "passkey", "whatsapp_otp"].includes(primaryAuthenticationMethod)
  )
    return resultErrorCreate("mfaLoginChallengeStart", "The primary authentication method is invalid.", "mfa.invalid")
  const primaryMethod = primaryAuthenticationMethod as
    | "email_otp"
    | "external_identity"
    | "password"
    | "passkey"
    | "whatsapp_otp"
  if (options.factor !== undefined && options.factor === primaryMethod)
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "The MFA factor must be distinct from the primary authentication method.",
      "mfa.factor-disabled",
    )
  const available = mfaFactorAvailabilityResolve({
    executor: options.executor,
    primaryAuthenticationMethod: primaryMethod,
    realmId: options.realmId,
    runtimeAvailableFactors: options.runtimeAvailableFactors,
    userId: options.userId,
  })
  if (!available.success) return available
  let organizationPolicy: OrganizationLoginPolicy | undefined
  if (options.policyDatabase !== undefined) {
    const resolved = organizationLoginPolicyResolve({
      database: options.policyDatabase,
      executor: options.executor,
      organizationId,
      realmId: options.realmId,
      runtimeAvailableFactors: available.data,
    })
    if (!resolved.success) return resolved
    organizationPolicy = resolved.data
  }
  const orderedFactors =
    organizationPolicy?.preferredFactorOrder ?? (available.data.includes("totp") ? (["totp"] as const) : ([] as const))
  if (orderedFactors.length === 0) {
    const permittedFactors = organizationPolicy?.allowedFactors ?? (["totp"] as const)
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "No permitted MFA factor is currently enrolled.",
      "mfa.enrollment-required",
      {
        availableFactors: [],
        permittedFactors,
        remediation: {
          action: "enroll_mfa_factor",
          factors: permittedFactors,
        },
      },
    )
  }
  const factor = options.factor ?? orderedFactors[0]
  if (factor === undefined || !orderedFactors.includes(factor))
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "The requested MFA factor is disabled for this organization.",
      "mfa.factor-disabled",
    )
  if (!available.data.includes(factor))
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "The requested MFA factor is unavailable.",
      "mfa.factor-unavailable",
    )
  if (factor === primaryMethod)
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "The MFA factor must be distinct from the primary authentication method.",
      "mfa.factor-disabled",
    )
  if (organizationPolicy === undefined && factor !== "totp")
    return resultErrorCreate(
      "mfaLoginChallengeStart",
      "The requested MFA factor is unavailable.",
      "mfa.factor-unavailable",
    )
  const tokenBytes = options.runtime.randomBytes(32)
  const token = Buffer.from(tokenBytes).toString("base64url")
  const challengeId = uuidv7Create(options.runtime)
  const expiresAt = options.now + 5 * 60 * 1_000
  const created = repository.mfaChallengeCreate({
    attempts: 0,
    availableFactors: JSON.stringify(orderedFactors),
    emailAddress: null,
    emailCodeHash: null,
    emailRetryAt: null,
    consumedAt: null,
    createdAt: options.now,
    deviceDescription: options.deviceMetadata?.description ?? null,
    deviceFingerprint: options.deviceMetadata?.fingerprint ?? null,
    expiresAt,
    factor,
    id: challengeId,
    realmId: options.realmId,
    ipAddress: options.deviceMetadata?.ipAddress ?? null,
    maxAttempts: legacyPolicy.maxAttempts,
    organizationId: organizationId ?? null,
    primaryAuthenticationMethod: primaryMethod,
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
  const event = eventSecurityEventAppend(
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
      userSubjectId: options.userId,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ challenge: mfaChallengeViewCreate(created.data), token })
}
