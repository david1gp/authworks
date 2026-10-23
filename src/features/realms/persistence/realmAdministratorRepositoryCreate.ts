import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type RealmAdministratorRow, realmAdministratorTable } from "./realmAdministratorTable.js"

export function realmAdministratorRepositoryCreate(database: StorageExecutor) {
  return {
    realmAdministratorGet(realmId: string, userId: string): Result<RealmAdministratorRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(realmAdministratorTable)
            .where(and(eq(realmAdministratorTable.realmId, realmId), eq(realmAdministratorTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "realmAdministratorGet",
          "The realm administrator could not be read.",
          "realms.read-failed",
        )
      }
    },

    realmAdministratorList(realmId: string): Result<RealmAdministratorRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(realmAdministratorTable)
            .where(eq(realmAdministratorTable.realmId, realmId))
            .orderBy(asc(realmAdministratorTable.createdAt), asc(realmAdministratorTable.userId))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "realmAdministratorList",
          "The realm administrators could not be read.",
          "realms.read-failed",
        )
      }
    },

    realmAdministratorInsert(input: typeof realmAdministratorTable.$inferInsert): Result<RealmAdministratorRow> {
      try {
        const created = database.insert(realmAdministratorTable).values(input).returning().get()
        if (created === undefined)
          return resultErrorCreate(
            "realmAdministratorInsert",
            "The realm administrator could not be created.",
            "realms.write-failed",
          )
        return resultCreate(created)
      } catch (_error) {
        return resultErrorCreate(
          "realmAdministratorInsert",
          "The realm administrator could not be created.",
          "realms.write-failed",
        )
      }
    },

    realmAdministratorDelete(realmId: string, userId: string): Result<RealmAdministratorRow | null> {
      try {
        return resultCreate(
          database
            .delete(realmAdministratorTable)
            .where(and(eq(realmAdministratorTable.realmId, realmId), eq(realmAdministratorTable.userId, userId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "realmAdministratorDelete",
          "The realm administrator could not be removed.",
          "realms.write-failed",
        )
      }
    },
  }
}
