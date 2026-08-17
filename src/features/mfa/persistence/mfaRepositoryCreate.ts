import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { mfaChallengeTable, type MfaChallengeRow } from "./mfaChallengeTable.js"
import { mfaLockoutTable, type MfaLockoutRow } from "./mfaLockoutTable.js"
import { mfaPolicyTable, type MfaPolicyRow } from "./mfaPolicyTable.js"
import { mfaRecoveryCodeTable, type MfaRecoveryCodeRow } from "./mfaRecoveryCodeTable.js"
import { mfaTotpEnrollmentTable, type MfaTotpEnrollmentRow } from "./mfaTotpEnrollmentTable.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"

export function mfaRepositoryCreate(database: StorageExecutor) {
  return {
    mfaEventVersionGet(instanceId: string, aggregateType: string, aggregateId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.instanceId, instanceId),
              eq(storageEventTable.aggregateType, aggregateType),
              eq(storageEventTable.aggregateId, aggregateId),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate("mfaEventVersionGet", "The MFA event version could not be read.")
      }
    },
    mfaChallengeCreate(input: typeof mfaChallengeTable.$inferInsert): Result<MfaChallengeRow> {
      try {
        const row = database.insert(mfaChallengeTable).values(input).returning().get()
        return row === undefined
          ? resultErrorCreate("mfaChallengeCreate", "The MFA challenge could not be created.")
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("mfaChallengeCreate", "The MFA challenge could not be created.")
      }
    },
    mfaChallengeGetByTokenHash(instanceId: string, tokenHash: string): Result<MfaChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaChallengeTable)
            .where(and(eq(mfaChallengeTable.instanceId, instanceId), eq(mfaChallengeTable.tokenHash, tokenHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaChallengeGet", "The MFA challenge could not be read.")
      }
    },
    mfaChallengeUpdate(
      instanceId: string,
      id: string,
      expectedVersion: number,
      input: Partial<typeof mfaChallengeTable.$inferInsert>,
    ): Result<MfaChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(mfaChallengeTable)
            .set(input)
            .where(
              and(
                eq(mfaChallengeTable.instanceId, instanceId),
                eq(mfaChallengeTable.id, id),
                eq(mfaChallengeTable.version, expectedVersion),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaChallengeUpdate", "The MFA challenge could not be updated.")
      }
    },
    mfaEnrollmentCreate(input: typeof mfaTotpEnrollmentTable.$inferInsert): Result<MfaTotpEnrollmentRow> {
      try {
        const row = database.insert(mfaTotpEnrollmentTable).values(input).returning().get()
        return row === undefined
          ? resultErrorCreate("mfaEnrollmentCreate", "The TOTP enrollment could not be created.")
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentCreate", "The TOTP enrollment could not be created.")
      }
    },
    mfaEnrollmentGet(instanceId: string, userId: string, id?: string): Result<MfaTotpEnrollmentRow | null> {
      try {
        const conditions = [
          eq(mfaTotpEnrollmentTable.instanceId, instanceId),
          eq(mfaTotpEnrollmentTable.userId, userId),
        ]
        if (id !== undefined) conditions.push(eq(mfaTotpEnrollmentTable.id, id))
        return resultCreate(
          database
            .select()
            .from(mfaTotpEnrollmentTable)
            .where(and(...conditions))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentGet", "The TOTP enrollment could not be read.")
      }
    },
    mfaEnrollmentActiveGet(instanceId: string, userId: string): Result<MfaTotpEnrollmentRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaTotpEnrollmentTable)
            .where(
              and(
                eq(mfaTotpEnrollmentTable.instanceId, instanceId),
                eq(mfaTotpEnrollmentTable.userId, userId),
                eq(mfaTotpEnrollmentTable.status, "active"),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentActiveGet", "The active TOTP enrollment could not be read.")
      }
    },
    mfaEnrollmentPendingDelete(instanceId: string, userId: string): Result<void> {
      try {
        database
          .delete(mfaTotpEnrollmentTable)
          .where(
            and(
              eq(mfaTotpEnrollmentTable.instanceId, instanceId),
              eq(mfaTotpEnrollmentTable.userId, userId),
              eq(mfaTotpEnrollmentTable.status, "pending"),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentPendingDelete", "The pending TOTP enrollment could not be replaced.")
      }
    },
    mfaEnrollmentDelete(instanceId: string, userId: string, id: string, expectedVersion: number): Result<boolean> {
      try {
        const updated = database
          .update(mfaTotpEnrollmentTable)
          .set({ status: "removed", version: expectedVersion + 1 })
          .where(
            and(
              eq(mfaTotpEnrollmentTable.instanceId, instanceId),
              eq(mfaTotpEnrollmentTable.userId, userId),
              eq(mfaTotpEnrollmentTable.id, id),
              eq(mfaTotpEnrollmentTable.version, expectedVersion),
            ),
          )
          .returning()
          .get()
        return resultCreate(updated !== undefined)
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentDelete", "The TOTP enrollment could not be removed.")
      }
    },
    mfaEnrollmentUpdate(
      instanceId: string,
      userId: string,
      id: string,
      expectedVersion: number,
      input: Partial<typeof mfaTotpEnrollmentTable.$inferInsert>,
    ): Result<MfaTotpEnrollmentRow | null> {
      try {
        return resultCreate(
          database
            .update(mfaTotpEnrollmentTable)
            .set(input)
            .where(
              and(
                eq(mfaTotpEnrollmentTable.instanceId, instanceId),
                eq(mfaTotpEnrollmentTable.userId, userId),
                eq(mfaTotpEnrollmentTable.id, id),
                eq(mfaTotpEnrollmentTable.version, expectedVersion),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentUpdate", "The TOTP enrollment could not be updated.")
      }
    },
    mfaEnrollmentList(instanceId: string, userId: string): Result<MfaTotpEnrollmentRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaTotpEnrollmentTable)
            .where(and(eq(mfaTotpEnrollmentTable.instanceId, instanceId), eq(mfaTotpEnrollmentTable.userId, userId)))
            .orderBy(asc(mfaTotpEnrollmentTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("mfaEnrollmentList", "The TOTP enrollments could not be read.")
      }
    },
    mfaLockoutGet(instanceId: string, userId: string): Result<MfaLockoutRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaLockoutTable)
            .where(and(eq(mfaLockoutTable.instanceId, instanceId), eq(mfaLockoutTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaLockoutGet", "The MFA lockout could not be read.")
      }
    },
    mfaLockoutSet(input: typeof mfaLockoutTable.$inferInsert): Result<MfaLockoutRow> {
      try {
        const existing = database.select().from(mfaLockoutTable).where(eq(mfaLockoutTable.userId, input.userId)).get()
        if (existing === undefined) {
          const row = database.insert(mfaLockoutTable).values(input).returning().get()
          return row === undefined
            ? resultErrorCreate("mfaLockoutSet", "The MFA lockout could not be updated.")
            : resultCreate(row)
        }
        const row = database
          .update(mfaLockoutTable)
          .set(input)
          .where(and(eq(mfaLockoutTable.instanceId, input.instanceId), eq(mfaLockoutTable.userId, input.userId)))
          .returning()
          .get()
        return row === undefined
          ? resultErrorCreate("mfaLockoutSet", "The MFA lockout could not be updated.")
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("mfaLockoutSet", "The MFA lockout could not be updated.")
      }
    },
    mfaPolicyGet(instanceId: string): Result<MfaPolicyRow | null> {
      try {
        return resultCreate(
          database.select().from(mfaPolicyTable).where(eq(mfaPolicyTable.instanceId, instanceId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaPolicyGet", "The MFA policy could not be read.")
      }
    },
    mfaPolicySet(input: typeof mfaPolicyTable.$inferInsert): Result<MfaPolicyRow> {
      try {
        const existing = database
          .select()
          .from(mfaPolicyTable)
          .where(eq(mfaPolicyTable.instanceId, input.instanceId))
          .get()
        if (existing === undefined) {
          const row = database.insert(mfaPolicyTable).values(input).returning().get()
          return row === undefined
            ? resultErrorCreate("mfaPolicySet", "The MFA policy could not be updated.")
            : resultCreate(row)
        }
        const row = database
          .update(mfaPolicyTable)
          .set(input)
          .where(and(eq(mfaPolicyTable.instanceId, input.instanceId), eq(mfaPolicyTable.version, existing.version)))
          .returning()
          .get()
        return row === undefined
          ? resultErrorCreate("mfaPolicySet", "The MFA policy could not be updated.")
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("mfaPolicySet", "The MFA policy could not be updated.")
      }
    },
    mfaRecoveryCodeCreate(input: typeof mfaRecoveryCodeTable.$inferInsert): Result<MfaRecoveryCodeRow> {
      try {
        const row = database.insert(mfaRecoveryCodeTable).values(input).returning().get()
        return row === undefined
          ? resultErrorCreate("mfaRecoveryCodeCreate", "The recovery code could not be created.")
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("mfaRecoveryCodeCreate", "The recovery code could not be created.")
      }
    },
    mfaRecoveryCodesDelete(instanceId: string, userId: string): Result<void> {
      try {
        database
          .delete(mfaRecoveryCodeTable)
          .where(and(eq(mfaRecoveryCodeTable.instanceId, instanceId), eq(mfaRecoveryCodeTable.userId, userId)))
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate("mfaRecoveryCodesDelete", "The recovery codes could not be replaced.")
      }
    },
    mfaRecoveryCodeGet(instanceId: string, userId: string, codeHash: string): Result<MfaRecoveryCodeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaRecoveryCodeTable)
            .where(
              and(
                eq(mfaRecoveryCodeTable.instanceId, instanceId),
                eq(mfaRecoveryCodeTable.userId, userId),
                eq(mfaRecoveryCodeTable.codeHash, codeHash),
                isNull(mfaRecoveryCodeTable.consumedAt),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaRecoveryCodeGet", "The recovery code could not be read.")
      }
    },
    mfaRecoveryCodeConsume(
      instanceId: string,
      id: string,
      expectedVersion: number,
      now: number,
    ): Result<MfaRecoveryCodeRow | null> {
      try {
        return resultCreate(
          database
            .update(mfaRecoveryCodeTable)
            .set({ consumedAt: now, version: expectedVersion + 1 })
            .where(
              and(
                eq(mfaRecoveryCodeTable.instanceId, instanceId),
                eq(mfaRecoveryCodeTable.id, id),
                eq(mfaRecoveryCodeTable.version, expectedVersion),
                isNull(mfaRecoveryCodeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("mfaRecoveryCodeConsume", "The recovery code could not be consumed.")
      }
    },
    mfaRecoveryCodeList(instanceId: string, userId: string): Result<MfaRecoveryCodeRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(mfaRecoveryCodeTable)
            .where(and(eq(mfaRecoveryCodeTable.instanceId, instanceId), eq(mfaRecoveryCodeTable.userId, userId)))
            .orderBy(desc(mfaRecoveryCodeTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("mfaRecoveryCodeList", "The recovery codes could not be read.")
      }
    },
  }
}
