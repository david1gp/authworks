import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmPublicViewCreate } from "../domain/realmPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { Realm } from "../public/realmSchema.js"

type RealmListOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
}

export function realmList(options: RealmListOptions): Result<{ realms: Realm[] }> {
  const op = "realmList"
  if (options.context?.kind !== "system") return resultErrorCreate(op, "Only the system context can list realms.")
  const repository = realmRepositoryCreate(options.database.db)
  const rows = repository.realmList()
  if (!rows.success) return rows
  const realms: Realm[] = []
  for (const row of rows.data) {
    const domains = repository.realmDomainList(row.id)
    if (!domains.success) return domains
    realms.push(realmPublicViewCreate(row, domains.data))
  }
  return resultCreate({ realms })
}
