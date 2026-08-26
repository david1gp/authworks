import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaFactorSchema } from "../public/mfaFactorSchema.js"
import type { MfaLoginChallengeContext } from "../public/mfaLoginChallengeContextSchema.js"
import { mfaLoginChallengeContextSchema } from "../public/mfaLoginChallengeContextSchema.js"

type MfaLoginChallengeContextGetOptions = {
  readonly executor: StorageExecutor
  readonly expectedFactor?: "totp" | "email_otp" | "passkey"
  readonly expectedPurpose?: "login" | "step_up"
  readonly now: number
  readonly realmId: string
  readonly token: string
}

export function mfaLoginChallengeContextGet(
  options: MfaLoginChallengeContextGetOptions,
): Result<MfaLoginChallengeContext> {
  const op = "mfaLoginChallengeContextGet"
  const challenge = mfaRepositoryCreate(options.executor).mfaChallengeGetByTokenHash(
    options.realmId,
    mfaChallengeTokenHashCreate(options.token),
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.consumedAt !== null ||
    challenge.data.expiresAt <= options.now ||
    (options.expectedPurpose !== undefined && challenge.data.purpose !== options.expectedPurpose)
  )
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const context = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.executor,
    expectedRealmId: options.realmId,
  })
  if (!context.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const availableFactors = mfaChallengeFactorsParse(challenge.data.availableFactors)
  const factor = mfaFactorParse(challenge.data.factor)
  if (availableFactors === undefined || factor === undefined) {
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  }
  if (
    availableFactors.length === 0 ||
    new Set(availableFactors).size !== availableFactors.length ||
    !availableFactors.includes(factor) ||
    challenge.data.primaryAuthenticationMethod === factor
  ) {
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  }
  if (options.expectedFactor !== undefined && factor !== options.expectedFactor)
    return resultErrorCreate(op, "The MFA factor is not selected for this challenge.", "mfa.factor-disabled")
  const result = v.safeParse(mfaLoginChallengeContextSchema, {
    availableFactors,
    challengeId: challenge.data.id,
    expiresAt: challenge.data.expiresAt,
    factor,
    ...(context.data.organizationId === undefined ? {} : { organizationId: context.data.organizationId }),
    primaryAuthenticationMethod: challenge.data.primaryAuthenticationMethod,
    purpose: challenge.data.purpose,
    realmId: challenge.data.realmId,
    userId: challenge.data.userId,
  })
  if (!result.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  return resultCreate(result.output)
}

function mfaChallengeFactorsParse(value: string | null): MfaLoginChallengeContext["availableFactors"] | undefined {
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

function mfaFactorParse(value: string | null): MfaLoginChallengeContext["factor"] | undefined {
  const factor = v.safeParse(mfaFactorSchema, value)
  return factor.success ? factor.output : undefined
}
