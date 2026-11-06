import { count, eq } from "drizzle-orm"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { oidcClientTable } from "../persistence/oidcClientTable.js"

export function oidcClientRealmCount(database: StorageDatabase, realmId: string) {
  try {
    const row = database.db
      .select({ value: count() })
      .from(oidcClientTable)
      .where(eq(oidcClientTable.realmId, realmId))
      .get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate("oidcClientRealmCount", "The realm count could not be read.", "oidc.read-failed")
  }
}
