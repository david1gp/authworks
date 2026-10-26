import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import { mfaInitSkipGraceActive } from "./mfaInitSkipGraceActive.js"
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
  let organizationPolicy: OrganizationLoginPolicy | null = null
  if (options.policyDatabase !== undefined) {
    const resolved = organizationLoginPolicyResolve({
      database: options.policyDatabase,
      executor: options.executor,
      organizationId: options.organizationId,
      realmId: options.realmId,
    })
    if (!resolved.success) return resolved
    organizationPolicy = resolved.data
  }
  const organizationRequired = organizationPolicy?.requiredMfa ?? false
  const organizationMinimumStepUpAssurance = organizationPolicy?.minimumStepUpAssurance
  const legacyRequired = (legacyPolicy.data ?? mfaPolicyDefaults).mode === "required"
  const minimumAssuranceRequiresMfa =
    organizationMinimumStepUpAssurance !== undefined &&
    mfaAssuranceRankGet(organizationMinimumStepUpAssurance) > mfaAssuranceRankGet("authenticated")
  let required = organizationRequired || legacyRequired
  if (
    required &&
    (organizationPolicy?.forceMfaLocalOnly ?? false) &&
    options.primaryAuthenticationMethod === "external_identity"
  )
    required = false
  if (required || minimumAssuranceRequiresMfa) {
    if (
      required &&
      !minimumAssuranceRequiresMfa &&
      organizationPolicy !== null &&
      options.sessionCreate !== undefined
    ) {
      const grace = mfaInitSkipGraceActive({
        executor: options.executor,
        now: options.runtime.now(),
        policy: organizationPolicy,
        primaryAuthenticationMethod: options.primaryAuthenticationMethod,
        realmId: options.realmId,
        userId: options.userId,
      })
      if (!grace.success) return grace
      if (grace.data) {
        const session = options.sessionCreate()
        if (!session.success) return session
        return resultCreate({ session: session.data })
      }
    }
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
