import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcJwks } from "../public/oidcJwksSchema.js"

type OidcJwksGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

// Retired keys stay published for a fixed 24h grace window so in-flight
// tokens still verify, then drop out of the JWKS even before the deletable
// retired row is removed. The grace is fixed rather than derived from
// per-client token lifetimes: a single JWKS serves every client in the
// realm, and 24h covers the maximum 86400s access/id lifetime plus skew.
const oidcJwksRetiredGraceMs = 24 * 60 * 60 * 1_000

export function oidcJwksGet(options: OidcJwksGetOptions): Result<OidcJwks> {
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  const rows = oidcRepositoryCreate(options.database.db).signingKeyList(options.realmId)
  if (!rows.success) return rows
  const keys = []
  for (const row of rows.data) {
    if (row.status === "retired" && row.retiredAt !== null && row.retiredAt + oidcJwksRetiredGraceMs <= now) continue
    const signingKey = oidcSigningKeyPublicViewCreate(row)
    if (!signingKey.success) return signingKey
    keys.push(signingKey.data.publicJwk)
  }
  return resultCreate({ keys })
}
