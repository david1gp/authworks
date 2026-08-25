import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listCursorDecode } from "../../../platform/http/listCursorDecode.js"
import { listPageFromRows } from "../../../platform/http/listPageFromRows.js"
import { listPageSizeResolve } from "../../../platform/http/listPageSizeResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcRefreshTokenListResponse } from "../public/oidcRefreshTokenListResponseSchema.js"
import { oidcRefreshTokenMetadataSchema } from "../public/oidcRefreshTokenMetadataSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export function oidcRefreshTokenMeList(options: {
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly userId: string
}): Result<OidcRefreshTokenListResponse> {
  const op = "oidcRefreshTokenMeList"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The refresh-token ownership is invalid.", "oidc.invalid")
  const now = options.database.runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The refresh-token timestamp is invalid.", "oidc.invalid-timestamp")
  const sortBy = listSortByResolve(options.query?.sortBy, ["lastUsedAt", "familyId"], "lastUsedAt")
  if (!sortBy.success) return sortBy
  const sortField = sortBy.data === "familyId" ? "familyId" : "lastUsedAt"
  const pageSize = listPageSizeResolve(options.query?.pageSize)
  let after: { readonly familyId: string; readonly sortValue: string | number } | undefined
  if (options.query?.pageToken !== undefined) {
    const cursor = listCursorDecode(options.query.pageToken)
    if (!cursor.success) return cursor
    if (sortField === "familyId" && typeof cursor.data.k !== "string")
      return resultErrorCodedCreate(op, "The refresh-token cursor is invalid.", "oidc.invalid")
    if (sortField === "lastUsedAt" && typeof cursor.data.k !== "number")
      return resultErrorCodedCreate(op, "The refresh-token cursor is invalid.", "oidc.invalid")
    after = { familyId: cursor.data.id, sortValue: cursor.data.k }
  }
  const page = oidcRepositoryCreate(options.database.db).refreshTokenFamilyPage(options.realmId, options.userId, {
    after,
    limit: pageSize + 1,
    now,
    sortBy: sortField,
  })
  if (!page.success) return page
  const metadata = []
  for (const family of page.data) {
    let scope: string[]
    try {
      const parsedScope = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(family.scope))
      if (!parsedScope.success || new Set(parsedScope.output).size !== parsedScope.output.length) throw new Error()
      scope = parsedScope.output
    } catch (_error) {
      return resultErrorCodedCreate(op, "The refresh-token metadata is invalid.", "oidc.invalid")
    }
    const familyRevoked = family.revokedCount === family.rowCount
    const expired = family.expiredCount === family.rowCount
    const status = familyRevoked ? "revoked" : expired ? "expired" : "active"
    const parsed = v.safeParse(oidcRefreshTokenMetadataSchema, {
      clientId: family.clientId,
      clientName: family.clientName,
      createdAt: family.createdAt,
      expiresAt: family.expiresAt,
      familyId: family.familyId,
      lastUsedAt: family.lastUsedAt,
      revokedAt: familyRevoked ? family.revokedAt : null,
      scope,
      status,
    })
    if (!parsed.success) return resultErrorCodedCreate(op, "The refresh-token metadata is invalid.", "oidc.invalid")
    metadata.push(parsed.output)
  }
  return resultCreate(
    listPageFromRows({
      idGet: (item) => item.familyId,
      pageSize,
      rows: metadata,
      sortValueGet: (item) => (sortField === "familyId" ? item.familyId : (item.lastUsedAt ?? -1)),
    }),
  )
}
