import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type UserRow, userTable } from "../../users/persistence/userTable.js"
import { type EmailOtpChallengeRow, emailOtpChallengeTable } from "./emailOtpChallengeTable.js"

export function emailOtpRepositoryCreate(database: StorageExecutor) {
  return {
    emailOtpChallengeAttemptRecord(input: {
      attempts: number
      consumedAt: number | null
      expectedVersion: number
      id: string
      realmId: string
      version: number
    }): Result<EmailOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(emailOtpChallengeTable)
            .set({ attempts: input.attempts, consumedAt: input.consumedAt, version: input.version })
            .where(
              and(
                eq(emailOtpChallengeTable.id, input.id),
                eq(emailOtpChallengeTable.realmId, input.realmId),
                eq(emailOtpChallengeTable.version, input.expectedVersion),
                isNull(emailOtpChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeAttemptRecord",
          "The email OTP attempt could not be recorded.",
          "email-otp.write-failed",
        )
      }
    },

    emailOtpChallengeConsume(
      realmId: string,
      id: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<EmailOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(emailOtpChallengeTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(emailOtpChallengeTable.id, id),
                eq(emailOtpChallengeTable.realmId, realmId),
                eq(emailOtpChallengeTable.version, expectedVersion),
                isNull(emailOtpChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeConsume",
          "The email OTP challenge could not be consumed.",
          "email-otp.write-failed",
        )
      }
    },

    emailOtpChallengeCreate(input: typeof emailOtpChallengeTable.$inferInsert): Result<EmailOtpChallengeRow> {
      try {
        const row = database.insert(emailOtpChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "emailOtpChallengeCreate",
            "The email OTP challenge could not be created.",
            "email-otp.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeCreate",
          "The email OTP challenge could not be created.",
          "email-otp.write-failed",
        )
      }
    },

    emailOtpChallengeGet(realmId: string, id: string): Result<EmailOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(emailOtpChallengeTable)
            .where(and(eq(emailOtpChallengeTable.realmId, realmId), eq(emailOtpChallengeTable.id, id)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeGet",
          "The email OTP challenge could not be read.",
          "email-otp.read-failed",
        )
      }
    },

    emailOtpChallengeLatestGet(
      realmId: string,
      emailHash: string,
      purpose: string,
    ): Result<EmailOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(emailOtpChallengeTable)
            .where(
              and(
                eq(emailOtpChallengeTable.realmId, realmId),
                eq(emailOtpChallengeTable.emailHash, emailHash),
                eq(emailOtpChallengeTable.purpose, purpose),
              ),
            )
            .orderBy(desc(emailOtpChallengeTable.createdAt), desc(emailOtpChallengeTable.id))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeLatestGet",
          "The email OTP challenge could not be read.",
          "email-otp.read-failed",
        )
      }
    },

    emailOtpChallengeExpirePrevious(
      realmId: string,
      emailHash: string,
      purpose: string,
      consumedAt: number,
    ): Result<void> {
      try {
        database
          .update(emailOtpChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(emailOtpChallengeTable.realmId, realmId),
              eq(emailOtpChallengeTable.emailHash, emailHash),
              eq(emailOtpChallengeTable.purpose, purpose),
              isNull(emailOtpChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpChallengeExpirePrevious",
          "The previous email OTP challenges could not be closed.",
          "email-otp.write-failed",
        )
      }
    },

    emailOtpUserFindByEmail(realmId: string, email: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.realmId, realmId), eq(userTable.email, email)))
            .orderBy(asc(userTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "emailOtpUserFindByEmail",
          "The email OTP user could not be read.",
          "email-otp.read-failed",
        )
      }
    },

    emailOtpUserGet(realmId: string, userId: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.realmId, realmId), eq(userTable.id, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("emailOtpUserGet", "The email OTP user could not be read.", "email-otp.read-failed")
      }
    },
  }
}
