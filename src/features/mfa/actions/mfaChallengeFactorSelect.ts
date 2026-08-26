import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaChallengeViewCreate } from "../domain/mfaChallengeViewCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeResponse } from "../public/mfaChallengeResponseSchema.js"
import type { MfaPolicyFactor } from "../public/mfaPolicyFactorSchema.js"
import { mfaLoginChallengeContextGet } from "../server/mfaLoginChallengeContextGet.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

type MfaChallengeFactorSelectOptions = {
  readonly database: StorageDatabase
  readonly factor: MfaPolicyFactor
  readonly realmId: string
  readonly token: string
  readonly runtime?: { now: () => number; randomBytes: (length: number) => Uint8Array }
}

export function mfaChallengeFactorSelect(options: MfaChallengeFactorSelectOptions): Result<MfaChallengeResponse> {
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  return storageTransactionRun(options.database, (transaction) => {
    const context = mfaLoginChallengeContextGet({
      executor: transaction,
      now,
      realmId: options.realmId,
      token: options.token,
    })
    if (!context.success) return context
    if (!context.data.availableFactors.includes(options.factor))
      return resultErrorCreate(
        "mfaChallengeFactorSelect",
        "The MFA factor is not available for this challenge.",
        "mfa.factor-disabled",
      )
    const available = mfaFactorAvailabilityResolve({
      executor: transaction,
      primaryAuthenticationMethod: context.data.primaryAuthenticationMethod,
      realmId: options.realmId,
      userId: context.data.userId,
    })
    if (!available.success) return available
    if (!available.data.includes(options.factor))
      return resultErrorCreate("mfaChallengeFactorSelect", "The MFA factor is unavailable.", "mfa.factor-unavailable")
    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: transaction,
      organizationId: context.data.organizationId,
      realmId: options.realmId,
      runtimeAvailableFactors: available.data,
    })
    if (!policy.success) return policy
    if (!policy.data.preferredFactorOrder.includes(options.factor))
      return resultErrorCreate(
        "mfaChallengeFactorSelect",
        "The MFA factor is not available for this organization.",
        "mfa.factor-disabled",
      )
    const repository = mfaRepositoryCreate(transaction)
    const current = repository.mfaChallengeGetByTokenHash(options.realmId, mfaChallengeTokenHashCreate(options.token))
    if (!current.success) return current
    if (current.data === null)
      return resultErrorCreate("mfaChallengeFactorSelect", "The MFA challenge is invalid.", "mfa.invalid")
    const updated = repository.mfaChallengeUpdate(options.realmId, current.data.id, current.data.version, {
      emailAddress: null,
      emailCodeHash: null,
      emailRetryAt: null,
      factor: options.factor,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCreate("mfaChallengeFactorSelect", "The MFA challenge is invalid.", "mfa.write-failed")
    return resultCreate({ challenge: mfaChallengeViewCreate(updated.data), token: options.token })
  })
}
