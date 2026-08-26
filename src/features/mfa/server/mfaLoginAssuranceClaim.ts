import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import type { SessionMfaMethod } from "../../sessions/public/sessionMfaMethodSchema.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaFactorSchema } from "../public/mfaFactorSchema.js"

type MfaLoginAssuranceClaimOptions = {
  readonly challengeId: string
  readonly database: StorageDatabase
  readonly executor: StorageExecutor
  readonly factor: SessionMfaMethod
  readonly organizationId?: string
  readonly primaryAuthenticationMethod: SessionAuthenticationMethod
  readonly realmId: string
  readonly sessionId: string
  readonly userId: string
  readonly now: number
}

export function mfaLoginAssuranceClaim(options: MfaLoginAssuranceClaimOptions): Result<void> {
  const op = "mfaLoginAssuranceClaim"
  if (options.challengeId.length === 0 || options.sessionId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The MFA proof is invalid.", "mfa.invalid")
  const challenge = mfaRepositoryCreate(options.executor).mfaChallengeGet(options.realmId, options.challengeId)
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.purpose !== "login" ||
    challenge.data.consumedAt === null ||
    challenge.data.expiresAt <= options.now ||
    challenge.data.sessionId !== null ||
    challenge.data.userId !== options.userId ||
    challenge.data.realmId !== options.realmId ||
    challenge.data.primaryAuthenticationMethod !== options.primaryAuthenticationMethod
  )
    return resultErrorCreate(op, "The MFA proof is invalid.", "mfa.invalid")
  const context = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.executor,
    expectedRealmId: options.realmId,
  })
  if (!context.success || context.data.organizationId !== options.organizationId)
    return resultErrorCreate(op, "The MFA proof organization context is invalid.", "mfa.unauthorized")
  const selectedFactor = v.safeParse(mfaFactorSchema, challenge.data.factor)
  if (!selectedFactor.success) return resultErrorCreate(op, "The MFA proof is invalid.", "mfa.invalid")
  const expectedFactor = options.factor === "recovery_code" ? selectedFactor.output : options.factor
  if (expectedFactor !== selectedFactor.output || selectedFactor.output === options.primaryAuthenticationMethod)
    return resultErrorCreate(op, "The MFA proof factor is invalid.", "mfa.factor-disabled")
  const policy = organizationLoginPolicyResolve({
    database: options.database,
    executor: options.executor,
    organizationId: options.organizationId,
    realmId: options.realmId,
    runtimeAvailableFactors: [selectedFactor.output],
  })
  if (!policy.success) return policy
  if (!policy.data.allowedFactors.includes(selectedFactor.output))
    return resultErrorCreate(op, "The MFA proof factor is not permitted.", "mfa.factor-disabled")
  if (!policy.data.preferredFactorOrder.includes(selectedFactor.output))
    return resultErrorCreate(op, "The MFA proof factor is not available.", "mfa.factor-disabled")
  const claimed = mfaRepositoryCreate(options.executor).mfaChallengeUpdate(
    options.realmId,
    options.challengeId,
    challenge.data.version,
    { sessionId: options.sessionId, version: challenge.data.version + 1 },
  )
  if (!claimed.success) return claimed
  if (claimed.data === null) return resultErrorCreate(op, "The MFA proof is stale.", "mfa.invalid")
  return resultCreate(undefined)
}
