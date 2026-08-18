import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcConsentListResponse } from "../public/oidcConsentListResponseSchema.js"
import { oidcConsentSchema } from "../public/oidcConsentSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

type OidcConsentListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly query?: ListQuery
}

export function oidcConsentList(options: OidcConsentListOptions): Result<OidcConsentListResponse> {
  const op = "oidcConsentList"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  const rows = oidcRepositoryCreate(options.database.db).consentList(options.realmId, options.userId)
  if (!rows.success) return rows
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const consents = []
  for (const row of rows.data) {
    const scope = oidcConsentScopeParse(row.scope)
    if (!scope.success) return scope
    const parsed = v.safeParse(oidcConsentSchema, { ...row, scope: scope.data })
    if (!parsed.success) return resultErrorCodedCreate(op, "The OIDC consent is invalid.", "oidc.consent-invalid")
    consents.push(parsed.output)
  }
  return listRowsPage({
    idGet: (consent) => consent.clientId,
    query: options.query,
    rows: consents,
    sortValueGet: (consent) => (sortBy.data === "id" ? consent.clientId : consent.createdAt),
  })
}

function oidcConsentScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCodedCreate("oidcConsentScopeParse", "The OIDC consent is invalid.", "oidc.consent-invalid")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCodedCreate("oidcConsentScopeParse", "The OIDC consent is invalid.", "oidc.consent-invalid")
  }
}
