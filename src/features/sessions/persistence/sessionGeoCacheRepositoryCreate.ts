import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type SessionGeoCacheRow, sessionGeoCacheTable } from "./sessionGeoCacheTable.js"

export function sessionGeoCacheRepositoryCreate(database: StorageExecutor) {
  return {
    sessionGeoCacheGet(ip: string): Result<SessionGeoCacheRow | null> {
      try {
        return resultCreate(
          database.select().from(sessionGeoCacheTable).where(eq(sessionGeoCacheTable.ip, ip)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "sessionGeoCacheGet",
          "The cached session geo data could not be read.",
          "sessions.read-failed",
        )
      }
    },

    sessionGeoCacheUpsert(input: {
      readonly countryCode: string | null
      readonly ip: string
      readonly region: string | null
      readonly updatedAt: number
    }): Result<SessionGeoCacheRow> {
      try {
        const row = database
          .insert(sessionGeoCacheTable)
          .values(input)
          .onConflictDoUpdate({ set: input, target: sessionGeoCacheTable.ip })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCreate(
            "sessionGeoCacheUpsert",
            "The session geo cache could not be written.",
            "sessions.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "sessionGeoCacheUpsert",
          "The session geo cache could not be written.",
          "sessions.write-failed",
        )
      }
    },
  }
}
