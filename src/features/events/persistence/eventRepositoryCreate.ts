import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { type StorageEvent, storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"

export function eventRepositoryCreate(database: StorageExecutor) {
  return {
    eventList(realmId: string): Result<StorageEvent[]> {
      try {
        return resultCreate(
          database.select().from(storageEventTable).where(eq(storageEventTable.realmId, realmId)).all(),
        )
      } catch (_error) {
        return resultErrorCreate("eventList", "The events could not be read.", "events.read-failed")
      }
    },
  }
}
