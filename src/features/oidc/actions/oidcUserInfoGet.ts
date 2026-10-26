import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { projectSubjectProjectRoleResolve } from "../../projects/server/projectSubjectProjectRoleResolve.js"
import { userProfileTable } from "../../users/persistence/userProfileTable.js"
import { oidcAccessTokenRoleClaimsCreate } from "../domain/oidcAccessTokenRoleClaimsCreate.js"
import { oidcResourceOwnerOrganizationIdResolve } from "../domain/oidcResourceOwnerOrganizationIdResolve.js"
import { oidcResourceOwnerScope } from "../domain/oidcResourceOwnerScope.js"
import { oidcUserInfoClaimsCreate } from "../domain/oidcUserInfoClaimsCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcUserInfo } from "../public/oidcUserInfoSchema.js"
import { oidcAccessTokenContextResolve } from "./oidcAccessTokenContextResolve.js"

type OidcUserInfoGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

// UserInfo role claims follow the access-token assertion, not the ID-token
// one: the access token authorizes UserInfo, so the roles visible there match
// the access token's claim exactly. Roles resolve at request time (never from
// stored token claims) so revocations and grants take effect immediately.
export function oidcUserInfoGet(options: OidcUserInfoGetOptions): Result<OidcUserInfo> {
  const context = oidcAccessTokenContextResolve({
    database: options.database,
    realmId: options.realmId,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    token: options.token,
  })
  if (!context.success) return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const profile =
      transaction
        .select()
        .from(userProfileTable)
        .where(and(eq(userProfileTable.realmId, options.realmId), eq(userProfileTable.userId, context.data.user.id)))
        .get() ?? null
    const resourceOwnerOrganizationId = context.data.scope.includes(oidcResourceOwnerScope)
      ? oidcResourceOwnerOrganizationIdResolve({
          executor: transaction,
          realmId: options.realmId,
          session: context.data.session,
          userId: context.data.user.id,
        })
      : resultCreate<string | undefined>(undefined)
    if (!resourceOwnerOrganizationId.success) return resourceOwnerOrganizationId
    const claims = oidcUserInfoClaimsCreate(
      {
        profile,
        resourceOwnerOrganizationId: resourceOwnerOrganizationId.data,
        session: context.data.session,
        user: context.data.user,
      },
      context.data.scope,
    )
    if (context.data.client.accessTokenRoleAssertion === 1 && context.data.client.projectId !== null) {
      const projectRoles = projectSubjectProjectRoleResolve({
        executor: transaction,
        projectId: context.data.client.projectId,
        realmId: options.realmId,
        userId: context.data.user.id,
      })
      if (!projectRoles.success) return projectRoles
      Object.assign(claims, oidcAccessTokenRoleClaimsCreate(projectRoles.data))
    }
    return resultCreate(claims)
  })
}
