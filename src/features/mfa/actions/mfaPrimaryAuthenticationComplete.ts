import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
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
  readonly executor: StorageTransaction
  readonly organizationId?: string
  readonly policyDatabase?: StorageDatabase
  readonly realmId: string
  readonly primaryAuthenticationMethod: SessionAuthenticationMethod
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionCreate?: () => Result<TSession>
  readonly userId: string
}

export function mfaPrimaryAuthenticationComplete<TSession>(
  options: MfaPrimaryAuthenticationCompleteOptions<TSession>,
): Result<{ readonly challenge?: MfaChallengeResponse; readonly session?: TSession }> {
  const repository = mfaRepositoryCreate(options.executor)
  const legacyPolicy = repository.mfaPolicyGet(options.realmId)
  if (!legacyPolicy.success) return legacyPolicy
  let organizationRequired = false
  let organizationMinimumStepUpAssurance: "none" | "authenticated" | "multi_factor" | undefined
  if (options.policyDatabase !== undefined) {
    const organizationPolicy = organizationLoginPolicyResolve({
      database: options.policyDatabase,
      executor: options.executor,
      organizationId: options.organizationId,
      realmId: options.realmId,
    })
    if (!organizationPolicy.success) return organizationPolicy
    organizationRequired = organizationPolicy.data.requiredMfa
    organizationMinimumStepUpAssurance = organizationPolicy.data.minimumStepUpAssurance
  }
  const legacyRequired = (legacyPolicy.data ?? mfaPolicyDefaults).mode === "required"
  const minimumAssuranceRequiresMfa =
    organizationMinimumStepUpAssurance !== undefined &&
    mfaAssuranceRankGet(organizationMinimumStepUpAssurance) > mfaAssuranceRankGet("authenticated")
  if (organizationRequired || legacyRequired || minimumAssuranceRequiresMfa) {
    const challenge = mfaLoginChallengeStart({
      actorId: options.actorId,
      deviceMetadata: options.deviceMetadata,
      executor: options.executor,
      organizationId: options.organizationId,
      policyDatabase: options.policyDatabase,
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

function mfaAssuranceRankGet(value: "none" | "authenticated" | "multi_factor"): number {
  if (value === "multi_factor") return 2
  if (value === "authenticated") return 1
  return 0
}
