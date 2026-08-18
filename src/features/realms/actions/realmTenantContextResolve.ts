import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmDomainNormalize } from "../domain/realmDomainNormalize.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmTenantContextCreate } from "../domain/realmTenantContextCreate.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"

type RealmTenantContextResolveOptions = {
  readonly database: StorageDatabase
  readonly host?: string
}

export function realmTenantContextResolve(options: RealmTenantContextResolveOptions): Result<RealmTenantContext> {
  const op = "realmTenantContextResolve"
  if (options.host === undefined || options.host.length === 0)
    return resultErrorCreate(op, "The tenant host was not found.", "realms.not-found")
  const host = options.host.startsWith("[")
    ? options.host.slice(1, options.host.indexOf("]"))
    : options.host.split(":")[0]
  const domain = realmDomainNormalize(host ?? "")
  if (!domain.success) return resultErrorCreate(op, "The tenant host was not found.", "realms.not-found")
  const realm = realmRepositoryCreate(options.database.db).realmFindByDomain(domain.data)
  if (!realm.success) return realm
  if (realm.data === null) return resultErrorCreate(op, "The tenant host was not found.", "realms.not-found")
  return resultCreate(realmTenantContextCreate(realm.data.id, "anonymous"))
}
