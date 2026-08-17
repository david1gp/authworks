import { and, asc, desc, eq, isNull, or } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userTable, type UserRow } from "../../users/persistence/userTable.js"
import { passwordChallengeTable, type PasswordChallengeRow } from "./passwordChallengeTable.js"
import { passwordCredentialTable, type PasswordCredentialRow } from "./passwordCredentialTable.js"
import { passwordLockoutTable, type PasswordLockoutRow } from "./passwordLockoutTable.js"
import { passwordPolicyTable, type PasswordPolicyRow } from "./passwordPolicyTable.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"

export function passwordRepositoryCreate(database: StorageExecutor) {
  return {
    passwordChallengeCreate(input: typeof passwordChallengeTable.$inferInsert): Result<PasswordChallengeRow> {
      try {
        const row = database.insert(passwordChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("passwordChallengeCreate", "The password challenge could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passwordChallengeCreate", "The password challenge could not be created.")
      }
    },

    passwordChallengeGet(instanceId: string, tokenHash: string, kind: string): Result<PasswordChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordChallengeTable)
            .where(
              and(
                eq(passwordChallengeTable.instanceId, instanceId),
                eq(passwordChallengeTable.kind, kind),
                eq(passwordChallengeTable.tokenHash, tokenHash),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordChallengeGet", "The password challenge could not be read.")
      }
    },

    passwordChallengeConsume(id: string, consumedAt: number): Result<PasswordChallengeRow | null> {
      try {
        const current = database
          .select()
          .from(passwordChallengeTable)
          .where(and(eq(passwordChallengeTable.id, id), isNull(passwordChallengeTable.consumedAt)))
          .get()
        if (current === undefined) return resultCreate(null)
        return resultCreate(
          database
            .update(passwordChallengeTable)
            .set({ consumedAt, version: current.version + 1 })
            .where(and(eq(passwordChallengeTable.id, id), isNull(passwordChallengeTable.consumedAt)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordChallengeConsume", "The password challenge could not be consumed.")
      }
    },

    passwordChallengeExpirePrevious(
      instanceId: string,
      userId: string,
      kind: string,
      consumedAt: number,
    ): Result<void> {
      try {
        database
          .update(passwordChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(passwordChallengeTable.instanceId, instanceId),
              eq(passwordChallengeTable.userId, userId),
              eq(passwordChallengeTable.kind, kind),
              isNull(passwordChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "passwordChallengeExpirePrevious",
          "The previous password challenges could not be closed.",
        )
      }
    },

    passwordCredentialCreate(input: typeof passwordCredentialTable.$inferInsert): Result<PasswordCredentialRow> {
      try {
        const row = database.insert(passwordCredentialTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("passwordCredentialCreate", "The password credential could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passwordCredentialCreate", "The password credential could not be created.")
      }
    },

    passwordCredentialGet(instanceId: string, userId: string): Result<PasswordCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordCredentialTable)
            .where(and(eq(passwordCredentialTable.instanceId, instanceId), eq(passwordCredentialTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordCredentialGet", "The password credential could not be read.")
      }
    },

    passwordCredentialUpdate(
      instanceId: string,
      userId: string,
      input: Partial<typeof passwordCredentialTable.$inferInsert>,
    ): Result<PasswordCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(passwordCredentialTable)
            .set(input)
            .where(and(eq(passwordCredentialTable.instanceId, instanceId), eq(passwordCredentialTable.userId, userId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordCredentialUpdate", "The password credential could not be updated.")
      }
    },

    passwordEventVersionGet(instanceId: string, userId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.instanceId, instanceId),
              eq(storageEventTable.aggregateId, userId),
              eq(storageEventTable.aggregateType, "password"),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate("passwordEventVersionGet", "The password event version could not be read.")
      }
    },

    passwordLockoutGet(instanceId: string, userId: string): Result<PasswordLockoutRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordLockoutTable)
            .where(and(eq(passwordLockoutTable.instanceId, instanceId), eq(passwordLockoutTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordLockoutGet", "The password lockout state could not be read.")
      }
    },

    passwordLockoutSet(input: typeof passwordLockoutTable.$inferInsert): Result<PasswordLockoutRow> {
      try {
        const row = database
          .insert(passwordLockoutTable)
          .values(input)
          .onConflictDoUpdate({
            set: {
              failedAttempts: input.failedAttempts,
              lockedUntil: input.lockedUntil,
              updatedAt: input.updatedAt,
              version: input.version,
            },
            target: passwordLockoutTable.userId,
          })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCreate("passwordLockoutSet", "The password lockout state could not be written.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passwordLockoutSet", "The password lockout state could not be written.")
      }
    },

    passwordPolicyGet(instanceId: string): Result<PasswordPolicyRow | null> {
      try {
        return resultCreate(
          database.select().from(passwordPolicyTable).where(eq(passwordPolicyTable.instanceId, instanceId)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordPolicyGet", "The password policy could not be read.")
      }
    },

    passwordPolicySet(input: typeof passwordPolicyTable.$inferInsert): Result<PasswordPolicyRow> {
      try {
        const row = database
          .insert(passwordPolicyTable)
          .values(input)
          .onConflictDoUpdate({
            set: {
              minimumLength: input.minimumLength,
              requireLowercase: input.requireLowercase,
              requireNumber: input.requireNumber,
              requireSymbol: input.requireSymbol,
              requireUppercase: input.requireUppercase,
              maximumAttempts: input.maximumAttempts,
              lockoutDurationMs: input.lockoutDurationMs,
              updatedAt: input.updatedAt,
              version: input.version,
            },
            target: passwordPolicyTable.instanceId,
          })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCreate("passwordPolicySet", "The password policy could not be written.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passwordPolicySet", "The password policy could not be written.")
      }
    },

    passwordUserFindByIdentifier(instanceId: string, identifier: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(
              and(
                eq(userTable.instanceId, instanceId),
                or(eq(userTable.email, identifier), eq(userTable.userName, identifier)),
              ),
            )
            .orderBy(asc(userTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordUserFindByIdentifier", "The user could not be read.")
      }
    },

    passwordUserGet(instanceId: string, userId: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.instanceId, instanceId), eq(userTable.id, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordUserGet", "The user could not be read.")
      }
    },
  }
}
