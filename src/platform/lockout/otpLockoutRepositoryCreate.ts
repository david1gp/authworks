import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageExecutor } from "../storage/storageSchema.js"
import { type OtpLockoutRow, otpLockoutTable } from "./otpLockoutTable.js"

export function otpLockoutRepositoryCreate(database: StorageExecutor) {
  return {
    otpLockoutGet(realmId: string, userId: string): Result<OtpLockoutRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(otpLockoutTable)
            .where(and(eq(otpLockoutTable.realmId, realmId), eq(otpLockoutTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("otpLockoutGet", "The OTP lockout state could not be read.")
      }
    },

    otpLockoutSet(input: typeof otpLockoutTable.$inferInsert): Result<OtpLockoutRow> {
      try {
        const row = database
          .insert(otpLockoutTable)
          .values(input)
          .onConflictDoUpdate({
            set: {
              failedAttempts: input.failedAttempts,
              lockedUntil: input.lockedUntil,
              updatedAt: input.updatedAt,
              version: input.version,
            },
            target: otpLockoutTable.userId,
          })
          .returning()
          .get()
        if (row === undefined) return resultErrorCreate("otpLockoutSet", "The OTP lockout state could not be written.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("otpLockoutSet", "The OTP lockout state could not be written.")
      }
    },
  }
}
