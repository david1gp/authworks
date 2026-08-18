import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmPublicViewCreate } from "../domain/realmPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import { realmRepositoryCreate } from "../persistence/realmRepositoryCreate.js"
import type { RealmListResponse } from "../public/realmListResponseSchema.js"
import type { Realm } from "../public/realmSchema.js"

type RealmListOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
}

export function realmList(options: RealmListOptions): Result<RealmListResponse> {
  const op = "realmList"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can list realms.", "realms.system-required")
  const repository = realmRepositoryCreate(options.database.db)
  const rows = repository.realmListWithDomains()
  if (!rows.success) return rows
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const realms: Realm[] = []
  for (const row of rows.data) {
    realms.push(realmPublicViewCreate(row.realm, row.domains))
  }
  return listRowsPage({
    idGet: (realm) => realm.id,
    query: options.query,
    rows: realms,
    sortValueGet: (realm) => (sortBy.data === "id" ? realm.id : realm.createdAt),
  })
}
