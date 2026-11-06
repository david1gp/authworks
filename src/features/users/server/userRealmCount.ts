import { count, eq } from "drizzle-orm"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userTable } from "../persistence/userTable.js"

export function userRealmCount(database: StorageDatabase, realmId: string) {
  try {
    const row = database.db.select({ value: count() }).from(userTable).where(eq(userTable.realmId, realmId)).get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate("userRealmCount", "The realm count could not be read.", "users.read-failed")
  }
}
