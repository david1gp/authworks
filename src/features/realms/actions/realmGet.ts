import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmPublicViewCreate } from "../domain/realmPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { Realm } from "../public/realmSchema.js"

type RealmGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function realmGet(options: RealmGetOptions): Result<{ realm: Realm }> {
  const op = "realmGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The realm is not available in this tenant context.")

  const repository = realmRepositoryCreate(options.database.db)
  const realm = repository.realmGet(options.realmId)
  if (!realm.success) return realm
  if (realm.data === null) return resultErrorCreate(op, "The realm was not found.")
  const domains = repository.realmDomainList(options.realmId)
  if (!domains.success) return domains
  return resultCreate({ realm: realmPublicViewCreate(realm.data, domains.data) })
}
