import { and, count, eq, gt, isNull } from "drizzle-orm"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionTable } from "../persistence/sessionTable.js"

export function sessionActiveRealmCount(database: StorageDatabase, realmId: string) {
  try {
    const row = database.db
      .select({ value: count() })
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, realmId),
          isNull(sessionTable.revokedAt),
          gt(sessionTable.expiresAt, database.runtime.now()),
        ),
      )
      .get()
    return resultCreate(row?.value ?? 0)
  } catch (_error) {
    return resultErrorCodedCreate(
      "sessionActiveRealmCount",
      "The realm count could not be read.",
      "sessions.read-failed",
    )
  }
}
