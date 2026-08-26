import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { emailOtpCodeCreate } from "../../emailOtp/domain/emailOtpCodeCreate.js"
import { emailOtpCodeHashCreate } from "../../emailOtp/domain/emailOtpCodeHashCreate.js"
import type { EmailOtpStartResponse } from "../../emailOtp/public/emailOtpStartResponseSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { userVerifiedEmailResolve } from "../../users/server/userVerifiedEmailResolve.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaEmailOtpDelivery } from "../public/mfaEmailOtpDeliverySchema.js"
import { mfaLoginChallengeContextGet } from "../server/mfaLoginChallengeContextGet.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

const mfaEmailOtpExpiryMs = 10 * 60 * 1_000
const mfaEmailOtpCooldownMs = 60 * 1_000

type MfaEmailOtpStartOptions = {
  readonly actorId?: string | null
  readonly challengeToken: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly onDelivery?: (delivery: MfaEmailOtpDelivery) => void | Promise<void>
}

type MfaEmailOtpStartCommit = {
  readonly delivery?: MfaEmailOtpDelivery
  readonly response: EmailOtpStartResponse
}

export function mfaEmailOtpStart(options: MfaEmailOtpStartOptions): Result<EmailOtpStartResponse> {
  const op = "mfaEmailOtpStart"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The MFA email OTP timestamp is invalid.", "mfa.invalid-timestamp")
  const committed = storageTransactionRun<MfaEmailOtpStartCommit>(options.database, (transaction) => {
    const context = mfaLoginChallengeContextGet({
      executor: transaction,
      expectedFactor: "email_otp",
      expectedPurpose: "login",
      now,
      realmId: options.realmId,
      token: options.challengeToken,
    })
    if (!context.success) return context
    const available = mfaFactorAvailabilityResolve({
      executor: transaction,
      primaryAuthenticationMethod: context.data.primaryAuthenticationMethod,
      realmId: options.realmId,
      userId: context.data.userId,
    })
    if (!available.success) return available
    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: transaction,
      organizationId: context.data.organizationId,
      realmId: options.realmId,
      runtimeAvailableFactors: available.data,
    })
    if (!policy.success) return policy
    if (!policy.data.preferredFactorOrder.includes("email_otp"))
      return resultErrorCreate(op, "The email OTP factor is unavailable.", "mfa.factor-disabled")
    const repository = mfaRepositoryCreate(transaction)
    const challenge = repository.mfaChallengeGetByTokenHash(
      options.realmId,
      mfaChallengeTokenHashCreate(options.challengeToken),
    )
    if (!challenge.success) return challenge
    if (challenge.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
    if (challenge.data.emailRetryAt !== null && challenge.data.emailRetryAt > now) {
      return resultCreate({
        response: {
          accepted: true,
          challengeId: challenge.data.id,
          expiresAt: challenge.data.expiresAt,
          retryAt: challenge.data.emailRetryAt,
        },
      })
    }
    const email = userVerifiedEmailResolve({
      executor: transaction,
      realmId: options.realmId,
      userId: context.data.userId,
    })
    if (!email.success) return email
    if (email.data === null)
      return resultErrorCreate(op, "A verified email is required for MFA.", "mfa.factor-unavailable")
    const code = emailOtpCodeCreate(runtime)
    if (!code.success) return code
    const retryAt = now + mfaEmailOtpCooldownMs
    const expiresAt = Math.min(challenge.data.expiresAt, now + mfaEmailOtpExpiryMs)
    const updated = repository.mfaChallengeUpdate(options.realmId, challenge.data.id, challenge.data.version, {
      emailAddress: email.data,
      emailCodeHash: emailOtpCodeHashCreate(challenge.data.id, code.data),
      emailRetryAt: retryAt,
      expiresAt,
      version: challenge.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.write-failed")
    return resultCreate({
      delivery: {
        challengeId: challenge.data.id,
        code: code.data,
        email: email.data,
        expiresAt,
        realmId: options.realmId,
        userId: context.data.userId,
      },
      response: { accepted: true, challengeId: challenge.data.id, expiresAt, retryAt },
    })
  })
  if (!committed.success) return committed
  if (committed.data.delivery !== undefined) mfaEmailOtpDeliveryInvoke(options.onDelivery, committed.data.delivery)
  return resultCreate(committed.data.response)
}

function mfaEmailOtpDeliveryInvoke(
  callback: ((delivery: MfaEmailOtpDelivery) => void | Promise<void>) | undefined,
  delivery: MfaEmailOtpDelivery,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
}
