import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import { mfaLoginChallengeStart } from "./mfaLoginChallengeStart.js"

type MfaPrimaryAuthenticationCompleteOptions<TSession> = {
  readonly actorId?: string | null
  readonly deviceMetadata?: {
    readonly description?: string
    readonly fingerprint?: string
    readonly ipAddress?: string
    readonly userAgent?: string
  }
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly primaryAuthenticationMethod: SessionAuthenticationMethod
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionCreate?: () => Result<TSession>
  readonly userId: string
}

export function mfaPrimaryAuthenticationComplete<TSession>(
  options: MfaPrimaryAuthenticationCompleteOptions<TSession>,
): Result<{ readonly challenge?: MfaChallengeResponse; readonly session?: TSession }> {
  const op = "mfaPrimaryAuthenticationComplete"
  const repository = mfaRepositoryCreate(options.executor)
  const policy = repository.mfaPolicyGet(options.realmId)
  if (!policy.success) return policy
  if ((policy.data ?? mfaPolicyDefaults).mode === "required") {
    const enrollment = repository.mfaEnrollmentActiveGet(options.realmId, options.userId)
    if (!enrollment.success) return enrollment
    if (enrollment.data === null) return resultErrorCreate(op, "MFA enrollment is required.", "mfa.not-found")
    const challenge = mfaLoginChallengeStart({
      actorId: options.actorId,
      deviceMetadata: options.deviceMetadata,
      executor: options.executor,
      realmId: options.realmId,
      primaryAuthenticationMethod: options.primaryAuthenticationMethod,
      purpose: "login",
      runtime: options.runtime,
      userId: options.userId,
    })
    if (!challenge.success) return challenge
    return resultCreate({ challenge: challenge.data })
  }
  if (options.sessionCreate === undefined) return resultCreate({})
  const session = options.sessionCreate()
  if (!session.success) return session
  return resultCreate({ session: session.data })
}
