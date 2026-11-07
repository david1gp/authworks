import { and, count, eq, gte, lte } from "drizzle-orm"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"

export function eventRealmTypeCount(
  database: StorageDatabase,
  realmId: string,
  eventType: string,
  since: number,
): Result<number> {
  try {
    const row = database.db
      .select({ value: count() })
      .from(storageEventTable)
      .where(
        and(
          eq(storageEventTable.realmId, realmId),
          eq(storageEventTable.eventType, eventType),
          gte(storageEventTable.occurredAt, since),
          lte(storageEventTable.occurredAt, database.runtime.now()),
        ),
      )
      .get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate(
      "eventRealmTypeCount",
      "The realm event count could not be read.",
      "events.read-failed",
    )
  }
}
