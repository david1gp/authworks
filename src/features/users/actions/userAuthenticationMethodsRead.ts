import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { mfaUserAuthenticationMethodsRead } from "../../mfa/server/mfaUserAuthenticationMethodsRead.js"
import { organizationLoginPolicyServerResolve } from "../../organizations/server/organizationLoginPolicyServerResolve.js"
import { passkeyUserAuthenticationMethodsRead } from "../../passkeys/server/passkeyUserAuthenticationMethodsRead.js"
import { passwordUsableAuthenticationMethodRead } from "../../passwords/server/passwordUsableAuthenticationMethodRead.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
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

  const methods = mfaUserAuthenticationMethodsRead({
    executor: options.database.db,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!methods.success) return methods
  const enrollments = methods.data.enrollments

  const passkeys = passkeyUserAuthenticationMethodsRead({
    executor: options.database.db,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!passkeys.success) return passkeys

  const password = passwordUsableAuthenticationMethodRead({
    executor: options.database.db,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!password.success) return password

  const policy = organizationLoginPolicyServerResolve({
    database: options.database,
    organizationId: options.context.actor.organizationId,
    realmId: options.realmId,
  })
  if (!policy.success) return policy

  return resultCreate({
    emailOtp: { available: policy.data.allowEmailOtp && user.data.emailVerifiedAt !== null },
    passkeys: { credentials: passkeys.data },
    password: password.data,
    recoveryCodes: methods.data.recoveryCodes,
    totp: { enrolled: enrollments.some((enrollment) => enrollment.status === "active"), enrollments },
  })
}
