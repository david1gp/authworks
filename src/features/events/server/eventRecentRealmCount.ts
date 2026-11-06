import { and, count, eq, gte, lte } from "drizzle-orm"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"

export function eventRecentRealmCount(database: StorageDatabase, realmId: string) {
  try {
    const row = database.db
      .select({ value: count() })
      .from(storageEventTable)
      .where(
        and(
          eq(storageEventTable.realmId, realmId),
          gte(storageEventTable.occurredAt, database.runtime.now() - 86_400_000),
          lte(storageEventTable.occurredAt, database.runtime.now()),
        ),
      )
      .get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate("eventRecentRealmCount", "The realm count could not be read.", "events.read-failed")
  }
}
