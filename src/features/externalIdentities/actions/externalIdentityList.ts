import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { externalIdentityViewCreate } from "../domain/externalIdentityViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import { externalIdentityProviderTable } from "../persistence/externalIdentityProviderTable.js"
import type { ExternalIdentityListResponse } from "../public/externalIdentityListResponseSchema.js"

type ExternalIdentityListOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly session: Session
  readonly query?: ListQuery
  readonly userId: string
}

export function externalIdentityList(options: ExternalIdentityListOptions): Result<ExternalIdentityListResponse> {
  const identities = externalIdentityRepositoryCreate(options.database.db).externalIdentityList(
    options.realmId,
    options.userId,
  )
  if (options.session.realmId !== options.realmId || options.session.userId !== options.userId)
    return resultErrorCreate(
      "externalIdentityList",
      "The session does not belong to this user.",
      "external-identities.forbidden",
    )
  if (options.session.assurance === "none")
    return resultErrorCreate(
      "externalIdentityList",
      "Session authorization is required.",
      "external-identities.unauthorized",
    )
  if (!identities.success) return identities
  const result = []
  for (const identity of identities.data) {
    const provider = options.database.db
      .select({ type: externalIdentityProviderTable.type })
      .from(externalIdentityProviderTable)
      .where(
        and(
          eq(externalIdentityProviderTable.id, identity.providerId),
          eq(externalIdentityProviderTable.realmId, options.realmId),
        ),
      )
      .get()
    if (provider === undefined) continue
    result.push(externalIdentityViewCreate(identity, provider.type))
  }
  return listRowsPage({
    idGet: (identity) => identity.id,
    query: options.query,
    rows: result,
    sortValueGet: (identity) => identity.createdAt,
  })
}
