import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { userTable } from "../../users/persistence/userTable.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

type MfaInitSkipGraceActiveOptions = {
  readonly executor: StorageTransaction
  readonly now: number
  readonly policy: Pick<OrganizationLoginPolicy, "allowedFactors" | "mfaInitSkipLifetimeSeconds">
  readonly primaryAuthenticationMethod: SessionAuthenticationMethod
  readonly realmId: string
  readonly userId: string
}

export function mfaInitSkipGraceActive(options: MfaInitSkipGraceActiveOptions): Result<boolean> {
  const skipSeconds = options.policy.mfaInitSkipLifetimeSeconds
  if (skipSeconds === null || skipSeconds === undefined) return resultCreate(false)
  const user = options.executor
    .select({ createdAt: userTable.createdAt })
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, options.userId)))
    .get()
  if (user === undefined) return resultCreate(false)
  if (options.now - user.createdAt > skipSeconds * 1_000) return resultCreate(false)
  if (
    options.primaryAuthenticationMethod !== "email_otp" &&
    options.primaryAuthenticationMethod !== "external_identity" &&
    options.primaryAuthenticationMethod !== "password" &&
    options.primaryAuthenticationMethod !== "passkey" &&
    options.primaryAuthenticationMethod !== "whatsapp_otp"
  )
    return resultCreate(false)
  const available = mfaFactorAvailabilityResolve({
    executor: options.executor,
    primaryAuthenticationMethod: options.primaryAuthenticationMethod,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!available.success) return resultCreate(false)
  const enrolled = available.data.some((factor) => options.policy.allowedFactors.includes(factor))
  return resultCreate(!enrolled)
}
