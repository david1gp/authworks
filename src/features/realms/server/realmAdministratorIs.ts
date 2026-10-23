import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { realmAdministratorRepositoryCreate } from "../persistence/realmAdministratorRepositoryCreate.js"

type RealmAdministratorIsOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function realmAdministratorIs(options: RealmAdministratorIsOptions): Result<boolean> {
  const executor =
    "db" in options.database ? (options.database as StorageDatabase).db : (options.database as StorageExecutor)
  const current = realmAdministratorRepositoryCreate(executor).realmAdministratorGet(options.realmId, options.userId)
  if (!current.success) return resultErrorCreate(current.op, current.errorMessage, "realms.read-failed")
  return resultCreate(current.data !== null)
}
