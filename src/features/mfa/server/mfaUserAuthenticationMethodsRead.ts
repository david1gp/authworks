import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"

type MfaUserAuthenticationMethodsReadOptions = {
  readonly executor: StorageExecutor
  readonly now?: number
  readonly realmId: string
  readonly userId: string
}

/** Unconfirmed authenticator setups disappear from the account surface after one hour. */
export const mfaPendingEnrollmentExpiryMs = 3_600_000

/** Reads only non-secret TOTP enrollment and recovery-code metadata for a realm-local user. */
export function mfaUserAuthenticationMethodsRead(options: MfaUserAuthenticationMethodsReadOptions): Result<{
  readonly enrollments: {
    readonly confirmedAt: number | null
    readonly id: string
    readonly label: string
    readonly status: "pending" | "active"
  }[]
  readonly recoveryCodes: {
    readonly available: boolean
    readonly generatedAt: number | null
    readonly remaining: number
  }
}> {
  const repository = mfaRepositoryCreate(options.executor)
  const enrollments = repository.mfaEnrollmentList(options.realmId, options.userId)
  if (!enrollments.success) return enrollments
  const recoveryCodes = repository.mfaRecoveryCodeList(options.realmId, options.userId)
  if (!recoveryCodes.success) return recoveryCodes
  const remaining = recoveryCodes.data.filter((code) => code.consumedAt === null).length
  const generatedAt = recoveryCodes.data.reduce<number | null>(
    (latest, code) => (latest === null || code.createdAt > latest ? code.createdAt : latest),
    null,
  )
  const now = options.now ?? Date.now()
  return resultCreate({
    enrollments: enrollments.data
      .filter(
        (enrollment) =>
          enrollment.status === "active" ||
          (enrollment.status === "pending" && enrollment.createdAt > now - mfaPendingEnrollmentExpiryMs),
      )
      .map((enrollment) => ({
        confirmedAt: enrollment.confirmedAt,
        id: enrollment.id,
        label: enrollment.label,
        status: enrollment.status as "pending" | "active",
      })),
    recoveryCodes: { available: remaining > 0, generatedAt, remaining },
  })
}
