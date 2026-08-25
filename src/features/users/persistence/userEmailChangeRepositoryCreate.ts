import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type UserEmailChangeChallengeRow, userEmailChangeChallengeTable } from "./userEmailChangeChallengeTable.js"

export function userEmailChangeRepositoryCreate(database: StorageExecutor) {
  return {
    userEmailChangeChallengeAttemptRecord(input: {
      attempts: number
      consumedAt: number | null
      expectedVersion: number
      id: string
      realmId: string
      version: number
    }): Result<UserEmailChangeChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(userEmailChangeChallengeTable)
            .set({ attempts: input.attempts, consumedAt: input.consumedAt, version: input.version })
            .where(
              and(
                eq(userEmailChangeChallengeTable.id, input.id),
                eq(userEmailChangeChallengeTable.realmId, input.realmId),
                eq(userEmailChangeChallengeTable.version, input.expectedVersion),
                isNull(userEmailChangeChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeAttemptRecord",
          "The email-change attempt could not be recorded.",
          "users.write-failed",
        )
      }
    },

    userEmailChangeChallengeConsume(
      realmId: string,
      id: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<UserEmailChangeChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(userEmailChangeChallengeTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(userEmailChangeChallengeTable.id, id),
                eq(userEmailChangeChallengeTable.realmId, realmId),
                eq(userEmailChangeChallengeTable.version, expectedVersion),
                isNull(userEmailChangeChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeConsume",
          "The email-change challenge could not be consumed.",
          "users.write-failed",
        )
      }
    },

    userEmailChangeChallengeCreate(
      input: typeof userEmailChangeChallengeTable.$inferInsert,
    ): Result<UserEmailChangeChallengeRow> {
      try {
        const row = database.insert(userEmailChangeChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "userEmailChangeChallengeCreate",
            "The email-change challenge could not be created.",
            "users.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeCreate",
          "The email-change challenge could not be created.",
          "users.write-failed",
        )
      }
    },

    userEmailChangeChallengeExpirePrevious(realmId: string, userId: string, consumedAt: number): Result<void> {
      try {
        database
          .update(userEmailChangeChallengeTable)
            .set({ consumedAt, version: sql`${userEmailChangeChallengeTable.version} + 1` })
          .where(
            and(
              eq(userEmailChangeChallengeTable.realmId, realmId),
              eq(userEmailChangeChallengeTable.userId, userId),
              isNull(userEmailChangeChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeExpirePrevious",
          "The previous email-change challenges could not be closed.",
          "users.write-failed",
        )
      }
    },

    userEmailChangeChallengeGet(
      realmId: string,
      userId: string,
      id: string,
    ): Result<UserEmailChangeChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userEmailChangeChallengeTable)
            .where(
              and(
                eq(userEmailChangeChallengeTable.realmId, realmId),
                eq(userEmailChangeChallengeTable.userId, userId),
                eq(userEmailChangeChallengeTable.id, id),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeGet",
          "The email-change challenge could not be read.",
          "users.read-failed",
        )
      }
    },

    userEmailChangeChallengeLatestGet(
      realmId: string,
      userId: string,
      pendingEmail: string,
    ): Result<UserEmailChangeChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userEmailChangeChallengeTable)
            .where(
              and(
                eq(userEmailChangeChallengeTable.realmId, realmId),
                eq(userEmailChangeChallengeTable.userId, userId),
                eq(userEmailChangeChallengeTable.pendingEmail, pendingEmail),
              ),
            )
            .orderBy(desc(userEmailChangeChallengeTable.createdAt), desc(userEmailChangeChallengeTable.id))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "userEmailChangeChallengeLatestGet",
          "The email-change challenge could not be read.",
          "users.read-failed",
        )
      }
    },
  }
}
