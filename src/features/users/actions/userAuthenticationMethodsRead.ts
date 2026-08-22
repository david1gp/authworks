import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { mfaRepositoryCreate } from "../../mfa/persistence/mfaRepositoryCreate.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { passkeyCredentialViewCreate } from "../../passkeys/domain/passkeyCredentialViewCreate.js"
import { passkeyRepositoryCreate } from "../../passkeys/persistence/passkeyRepositoryCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserAuthenticationMethods } from "../public/userAuthenticationMethodsSchema.js"

type UserAuthenticationMethodsReadOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

/** Reads only non-secret authentication-method metadata for a realm-local user. */
export function userAuthenticationMethodsRead(
  options: UserAuthenticationMethodsReadOptions,
): Result<UserAuthenticationMethods> {
  const op = "userAuthenticationMethodsRead"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind !== "tenant" || options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The authentication methods are not available in this tenant context.",
      "users.tenant-mismatch",
    )
  if (options.userId.length === 0) return resultErrorCreate(op, "The user was not found.", "users.not-found")

  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted")
    return resultErrorCreate(op, "The user was not found.", "users.not-found")

  const totp = mfaRepositoryCreate(options.database.db).mfaEnrollmentList(options.realmId, options.userId)
  if (!totp.success) return totp
  const enrollments = totp.data
    .filter((enrollment) => enrollment.status === "pending" || enrollment.status === "active")
    .map((enrollment) => ({
      confirmedAt: enrollment.confirmedAt,
      id: enrollment.id,
      label: enrollment.label,
      status: enrollment.status as "pending" | "active",
    }))

  const recoveryCodes = mfaRepositoryCreate(options.database.db).mfaRecoveryCodeList(options.realmId, options.userId)
  if (!recoveryCodes.success) return recoveryCodes
  const remaining = recoveryCodes.data.filter((code) => code.consumedAt === null).length
  const generatedAt = recoveryCodes.data.reduce<number | null>(
    (latest, code) => (latest === null || code.createdAt > latest ? code.createdAt : latest),
    null,
  )

  const passkeys = passkeyRepositoryCreate(options.database.db).passkeyCredentialList(options.realmId, options.userId)
  if (!passkeys.success) return passkeys

  const policy = organizationLoginPolicyResolve({
    database: options.database,
    organizationId: options.context.actor.organizationId,
    realmId: options.realmId,
  })
  if (!policy.success) return policy

  return resultCreate({
    emailOtp: { available: policy.data.allowEmailOtp && user.data.emailVerifiedAt !== null },
    passkeys: { credentials: passkeys.data.map(passkeyCredentialViewCreate) },
    recoveryCodes: { available: remaining > 0, generatedAt, remaining },
    totp: { enrolled: enrollments.some((enrollment) => enrollment.status === "active"), enrollments },
  })
}
