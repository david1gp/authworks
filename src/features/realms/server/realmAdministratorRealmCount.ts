import { count, eq } from "drizzle-orm"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmAdministratorTable } from "../persistence/realmAdministratorTable.js"

export function realmAdministratorRealmCount(database: StorageDatabase, realmId: string) {
  try {
    const row = database.db
      .select({ value: count() })
      .from(realmAdministratorTable)
      .where(eq(realmAdministratorTable.realmId, realmId))
      .get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate(
      "realmAdministratorRealmCount",
      "The realm count could not be read.",
      "realms.read-failed",
    )
  }
}
