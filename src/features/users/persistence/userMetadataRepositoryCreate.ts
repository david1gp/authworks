import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type UserMetadataRow, userMetadataTable } from "./userMetadataTable.js"

export function userMetadataRepositoryCreate(database: StorageExecutor) {
  return {
    userMetadataCount(realmId: string, userId: string): Result<number> {
      try {
        const rows = database
          .select({ key: userMetadataTable.key })
          .from(userMetadataTable)
          .where(and(eq(userMetadataTable.realmId, realmId), eq(userMetadataTable.userId, userId)))
          .all()
        return resultCreate(rows.length)
      } catch (_error) {
        return resultErrorCodedCreate("userMetadataCount", "The user metadata could not be read.", "users.read-failed")
      }
    },

    userMetadataDelete(realmId: string, userId: string, key: string): Result<UserMetadataRow | null> {
      try {
        return resultCreate(
          database
            .delete(userMetadataTable)
            .where(
              and(
                eq(userMetadataTable.realmId, realmId),
                eq(userMetadataTable.userId, userId),
                eq(userMetadataTable.key, key),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "userMetadataDelete",
          "The user metadata could not be removed.",
          "users.write-failed",
        )
      }
    },

    userMetadataGet(realmId: string, userId: string, key: string): Result<UserMetadataRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userMetadataTable)
            .where(
              and(
                eq(userMetadataTable.realmId, realmId),
                eq(userMetadataTable.userId, userId),
                eq(userMetadataTable.key, key),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("userMetadataGet", "The user metadata could not be read.", "users.read-failed")
      }
    },

    userMetadataList(realmId: string, userId: string): Result<UserMetadataRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(userMetadataTable)
            .where(and(eq(userMetadataTable.realmId, realmId), eq(userMetadataTable.userId, userId)))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("userMetadataList", "The user metadata could not be read.", "users.read-failed")
      }
    },

    userMetadataUpsert(input: typeof userMetadataTable.$inferInsert): Result<UserMetadataRow> {
      try {
        const row = database
          .insert(userMetadataTable)
          .values(input)
          .onConflictDoUpdate({
            set: { updatedAt: input.updatedAt, value: input.value, version: input.version },
            target: [userMetadataTable.realmId, userMetadataTable.userId, userMetadataTable.key],
          })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "userMetadataUpsert",
            "The user metadata could not be saved.",
            "users.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "userMetadataUpsert",
          "The user metadata could not be saved.",
          "users.write-failed",
        )
      }
    },
  }
}
