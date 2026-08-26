import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaFactorSchema } from "../public/mfaFactorSchema.js"
import { mfaLoginChallengeContextSchema } from "../public/mfaLoginChallengeContextSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

type MfaPasskeyCompleteOptions = {
  readonly actorId?: string | null
  readonly challengeId: string
  readonly correlationId?: string
  readonly database: StorageTransaction
  readonly deviceMetadata?: {
    readonly description?: string
    readonly fingerprint?: string
    readonly ipAddress?: string
    readonly userAgent?: string
  }
  readonly policyDatabase: StorageDatabase
  readonly realmId: string
  readonly runtime: { now: () => number; randomBytes: (length: number) => Uint8Array }
  readonly userId: string
}

export function mfaPasskeyComplete(options: MfaPasskeyCompleteOptions): Result<MfaLoginResponse> {
  const op = "mfaPasskeyComplete"
  const now = options.runtime.now()
  const correlationId = options.correlationId ?? uuidv7Create(options.runtime)
  const repository = mfaRepositoryCreate(options.database)
  const challenge = repository.mfaChallengeGet(options.realmId, options.challengeId)
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.consumedAt !== null ||
    challenge.data.expiresAt <= now ||
    challenge.data.purpose !== "login" ||
    challenge.data.factor !== "passkey" ||
    challenge.data.userId !== options.userId
  )
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const context = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.database,
    expectedRealmId: options.realmId,
  })
  if (!context.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const challengeContext = v.safeParse(mfaLoginChallengeContextSchema, {
    availableFactors: mfaChallengeFactorsParse(challenge.data.availableFactors),
    challengeId: challenge.data.id,
    expiresAt: challenge.data.expiresAt,
    factor: "passkey",
    ...(context.data.organizationId === undefined ? {} : { organizationId: context.data.organizationId }),
    primaryAuthenticationMethod: challenge.data.primaryAuthenticationMethod,
    purpose: challenge.data.purpose,
    realmId: challenge.data.realmId,
    userId: challenge.data.userId,
  })
  if (!challengeContext.success || challengeContext.output.primaryAuthenticationMethod === "passkey")
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  if (!challengeContext.output.availableFactors.includes("passkey"))
    return resultErrorCreate(op, "The MFA factor is unavailable.", "mfa.factor-unavailable")
  const available = mfaFactorAvailabilityResolve({
    executor: options.database,
    primaryAuthenticationMethod: challengeContext.output.primaryAuthenticationMethod,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!available.success) return available
  if (!available.data.includes("passkey"))
    return resultErrorCreate(op, "The MFA factor is unavailable.", "mfa.factor-unavailable")
  const policy = organizationLoginPolicyResolve({
    database: options.policyDatabase,
    executor: options.database,
    organizationId: context.data.organizationId,
    realmId: options.realmId,
    runtimeAvailableFactors: available.data,
  })
  if (!policy.success) return policy
  if (!policy.data.allowedFactors.includes("passkey") || !policy.data.preferredFactorOrder.includes("passkey"))
    return resultErrorCreate(op, "The passkey factor is disabled for this organization.", "mfa.factor-disabled")
  const consumed = repository.mfaChallengeUpdate(options.realmId, challenge.data.id, challenge.data.version, {
    consumedAt: now,
    version: challenge.data.version + 1,
  })
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.write-failed")
  const payload = v.safeParse(mfaEventPayloadSchema, {
    challengeId: challenge.data.id,
    factor: "passkey",
    purpose: challenge.data.purpose,
    userId: options.userId,
  })
  if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
  const event = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.actorId ?? options.userId,
      aggregateId: challenge.data.id,
      aggregateType: "mfa_challenge",
      aggregateVersion: consumed.data.version,
      commandIndex: 2,
      correlationId,
      eventType: mfaEventTypes.challengeCompleted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: now,
      payload: payload.output,
      userSubjectId: options.userId,
    },
    options.runtime,
  )
  if (!event.success) return event
  const session = sessionIssue({
    actorId: options.actorId ?? options.userId,
    assurance: "multi_factor",
    authenticationMethod: challenge.data.primaryAuthenticationMethod as SessionAuthenticationMethod,
    commandIndex: 3,
    correlationId,
    database: options.policyDatabase,
    deviceMetadata: options.deviceMetadata,
    executor: options.database,
    organizationId: context.data.organizationId,
    realmId: options.realmId,
    mfaChallengeId: challenge.data.id,
    mfaMethod: "passkey",
    runtime: options.runtime,
    userId: options.userId,
  })
  if (!session.success)
    return resultErrorCreate(op, "The multi-factor session could not be created.", "mfa.write-failed")
  return resultCreate({
    authentication: { authenticatedAt: now, realmId: options.realmId, userId: options.userId },
    session: session.data,
  })
}

function mfaChallengeFactorsParse(value: string | null): string[] | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return undefined
    const factors = parsed.flatMap((item) => {
      const factor = v.safeParse(mfaFactorSchema, item)
      return factor.success ? [factor.output] : []
    })
    return factors.length === parsed.length ? factors : undefined
  } catch (_error) {
    return undefined
  }
}
