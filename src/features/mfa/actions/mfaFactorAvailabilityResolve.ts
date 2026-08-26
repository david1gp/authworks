import { and, eq, isNotNull } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passkeyUserFactorAvailable } from "../../passkeys/server/passkeyUserFactorAvailable.js"
import { userEmailTable } from "../../users/persistence/userEmailTable.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaFactorSchema } from "../public/mfaFactorSchema.js"
import type { MfaPolicyFactor } from "../public/mfaPolicyFactorSchema.js"

type MfaFactorAvailabilityResolveOptions = {
  readonly executor: StorageExecutor
  readonly primaryAuthenticationMethod: "email_otp" | "external_identity" | "password" | "passkey" | "whatsapp_otp"
  readonly realmId: string
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
  readonly userId: string
}

export function mfaFactorAvailabilityResolve(options: MfaFactorAvailabilityResolveOptions): Result<MfaPolicyFactor[]> {
  const available =
    options.runtimeAvailableFactors === undefined
      ? mfaFactorAvailabilityRead(options)
      : mfaFactorAvailabilityNormalize(options.runtimeAvailableFactors)
  const distinct = available.filter(
    (factor) =>
      !(
        (options.primaryAuthenticationMethod === "email_otp" && factor === "email_otp") ||
        (options.primaryAuthenticationMethod === "passkey" && factor === "passkey")
      ),
  )
  return resultCreate(distinct)
}

function mfaFactorAvailabilityNormalize(values: readonly MfaPolicyFactor[]): MfaPolicyFactor[] {
  const parsed = values.flatMap((value) => {
    const factor = v.safeParse(mfaFactorSchema, value)
    return factor.success ? [factor.output] : []
  })
  const available = new Set(parsed)
  const canonical: readonly MfaPolicyFactor[] = ["totp", "email_otp", "passkey"]
  return canonical.filter((factor) => available.has(factor))
}

function mfaFactorAvailabilityRead(options: MfaFactorAvailabilityResolveOptions): MfaPolicyFactor[] {
  const repository = mfaRepositoryCreate(options.executor)
  const enrollment = repository.mfaEnrollmentActiveGet(options.realmId, options.userId)
  const hasTotp = enrollment.success && enrollment.data !== null
  const email = options.executor
    .select({ id: userEmailTable.id })
    .from(userEmailTable)
    .where(
      and(
        eq(userEmailTable.realmId, options.realmId),
        eq(userEmailTable.userId, options.userId),
        eq(userEmailTable.isPrimary, true),
        isNotNull(userEmailTable.verifiedAt),
      ),
    )
    .get()
  const passkey = passkeyUserFactorAvailable({
    executor: options.executor,
    realmId: options.realmId,
    userId: options.userId,
  })
  return [
    ...(hasTotp ? (["totp"] as const) : []),
    ...(email !== undefined ? (["email_otp"] as const) : []),
    ...(passkey.success && passkey.data ? (["passkey"] as const) : []),
  ]
}
