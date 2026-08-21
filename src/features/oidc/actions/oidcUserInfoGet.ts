import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { userProfileTable } from "../../users/persistence/userProfileTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"
import type { OidcUserInfo } from "../public/oidcUserInfoSchema.js"

type OidcUserInfoGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

type OidcUserInfoSubject = {
  readonly profile: typeof userProfileTable.$inferSelect | null
  readonly session: typeof sessionTable.$inferSelect
  readonly user: typeof userTable.$inferSelect
}

export function oidcUserInfoGet(options: OidcUserInfoGetOptions): Result<OidcUserInfo> {
  if (options.realmId.length === 0 || options.token.length === 0)
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const access = repository.accessTokenGetByTokenHash(options.realmId, oidcHashCreate(options.token))
    if (!access.success) return access
    if (
      access.data === null ||
      access.data.realmId !== options.realmId ||
      access.data.expiresAt <= now ||
      access.data.revokedAt !== null
    )
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const session = transaction
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, options.realmId),
          eq(sessionTable.id, access.data.sessionId),
          eq(sessionTable.userId, access.data.userId),
        ),
      )
      .get()
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= now)
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const user = transaction
      .select()
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, access.data.userId)))
      .get()
    if (user === undefined || user.state !== "active" || user.deletedAt !== null)
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const profile =
      transaction
        .select()
        .from(userProfileTable)
        .where(and(eq(userProfileTable.realmId, options.realmId), eq(userProfileTable.userId, user.id)))
        .get() ?? null
    const scope = oidcUserInfoScopeParse(access.data.scope)
    if (!scope.success) return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    return resultCreate(oidcUserInfoClaimsCreate({ profile, session, user }, scope.data))
  })
}

function oidcUserInfoClaimsCreate(subject: OidcUserInfoSubject, scope: readonly string[]): OidcUserInfo {
  const claims: OidcUserInfo = { sub: subject.user.id }
  if (subject.session.impersonatorId !== null) claims.act = { sub: subject.session.impersonatorId }
  if (subject.session.assurance === "multi_factor") {
    claims.acr = "multi_factor"
    claims.amr = [
      ...new Set(
        [subject.session.authenticationMethod, subject.session.mfaMethod ?? undefined].filter(
          (value): value is string => value !== undefined,
        ),
      ),
    ]
    claims.auth_time = Math.floor(subject.session.createdAt / 1_000)
  }
  if (scope.includes("email")) {
    claims.email = subject.user.email
    claims.email_verified = subject.user.emailVerifiedAt !== null
  }
  if (scope.includes("profile")) {
    claims.preferred_username = subject.user.userName
    if (subject.profile?.displayName !== null && subject.profile?.displayName !== undefined)
      claims.name = subject.profile.displayName
    if (subject.profile?.firstName !== null && subject.profile?.firstName !== undefined)
      claims.given_name = subject.profile.firstName
    if (subject.profile?.lastName !== null && subject.profile?.lastName !== undefined)
      claims.family_name = subject.profile.lastName
    if (subject.profile?.nickName !== null && subject.profile?.nickName !== undefined)
      claims.nickname = subject.profile.nickName
    if (subject.profile?.preferredLanguage !== null && subject.profile?.preferredLanguage !== undefined)
      claims.locale = subject.profile.preferredLanguage
  }
  return claims
}

function oidcUserInfoScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcUserInfoScopeParse", "The access token scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcUserInfoScopeParse", "The access token scope is invalid.")
  }
}
