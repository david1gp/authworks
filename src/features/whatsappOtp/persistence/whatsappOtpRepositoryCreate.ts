import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type UserRow, userTable } from "../../users/persistence/userTable.js"
import { type WhatsappOtpChallengeRow, whatsappOtpChallengeTable } from "./whatsappOtpChallengeTable.js"

export function whatsappOtpRepositoryCreate(database: StorageExecutor) {
  return {
    whatsappOtpChallengeAttemptRecord(input: {
      attempts: number
      consumedAt: number | null
      expectedVersion: number
      id: string
      realmId: string
      version: number
    }): Result<WhatsappOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(whatsappOtpChallengeTable)
            .set({ attempts: input.attempts, consumedAt: input.consumedAt, version: input.version })
            .where(
              and(
                eq(whatsappOtpChallengeTable.id, input.id),
                eq(whatsappOtpChallengeTable.realmId, input.realmId),
                eq(whatsappOtpChallengeTable.version, input.expectedVersion),
                isNull(whatsappOtpChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeAttemptRecord",
          "The WhatsApp OTP attempt could not be recorded.",
          "whatsapp-otp.write-failed",
        )
      }
    },

    whatsappOtpChallengeConsume(
      realmId: string,
      id: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<WhatsappOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(whatsappOtpChallengeTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(whatsappOtpChallengeTable.id, id),
                eq(whatsappOtpChallengeTable.realmId, realmId),
                eq(whatsappOtpChallengeTable.version, expectedVersion),
                isNull(whatsappOtpChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeConsume",
          "The WhatsApp OTP challenge could not be consumed.",
          "whatsapp-otp.write-failed",
        )
      }
    },

    whatsappOtpChallengeCreate(input: typeof whatsappOtpChallengeTable.$inferInsert): Result<WhatsappOtpChallengeRow> {
      try {
        const row = database.insert(whatsappOtpChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "whatsappOtpChallengeCreate",
            "The WhatsApp OTP challenge could not be created.",
            "whatsapp-otp.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeCreate",
          "The WhatsApp OTP challenge could not be created.",
          "whatsapp-otp.write-failed",
        )
      }
    },

    whatsappOtpChallengeExpirePrevious(
      realmId: string,
      phoneHash: string,
      purpose: string,
      consumedAt: number,
    ): Result<void> {
      try {
        database
          .update(whatsappOtpChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(whatsappOtpChallengeTable.realmId, realmId),
              eq(whatsappOtpChallengeTable.phoneHash, phoneHash),
              eq(whatsappOtpChallengeTable.purpose, purpose),
              isNull(whatsappOtpChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeExpirePrevious",
          "The previous WhatsApp OTP challenges could not be closed.",
          "whatsapp-otp.write-failed",
        )
      }
    },

    whatsappOtpChallengeGet(realmId: string, id: string): Result<WhatsappOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(whatsappOtpChallengeTable)
            .where(and(eq(whatsappOtpChallengeTable.realmId, realmId), eq(whatsappOtpChallengeTable.id, id)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeGet",
          "The WhatsApp OTP challenge could not be read.",
          "whatsapp-otp.read-failed",
        )
      }
    },

    whatsappOtpChallengeLatestGet(
      realmId: string,
      phoneHash: string,
      purpose: string,
    ): Result<WhatsappOtpChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(whatsappOtpChallengeTable)
            .where(
              and(
                eq(whatsappOtpChallengeTable.realmId, realmId),
                eq(whatsappOtpChallengeTable.phoneHash, phoneHash),
                eq(whatsappOtpChallengeTable.purpose, purpose),
              ),
            )
            .orderBy(desc(whatsappOtpChallengeTable.createdAt), desc(whatsappOtpChallengeTable.id))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpChallengeLatestGet",
          "The WhatsApp OTP challenge could not be read.",
          "whatsapp-otp.read-failed",
        )
      }
    },

    whatsappOtpUserFindByPhone(realmId: string, phoneNumber: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(
              and(
                eq(userTable.realmId, realmId),
                eq(userTable.phoneNumber, phoneNumber),
                isNotNull(userTable.phoneNumberVerifiedAt),
              ),
            )
            .orderBy(asc(userTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpUserFindByPhone",
          "The WhatsApp OTP user could not be read.",
          "whatsapp-otp.read-failed",
        )
      }
    },

    whatsappOtpUserGet(realmId: string, userId: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.realmId, realmId), eq(userTable.id, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "whatsappOtpUserGet",
          "The WhatsApp OTP user could not be read.",
          "whatsapp-otp.read-failed",
        )
      }
    },
  }
}
