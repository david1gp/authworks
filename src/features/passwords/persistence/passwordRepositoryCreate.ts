import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userEmailRepositoryCreate } from "../../users/persistence/userEmailRepositoryCreate.js"
import { type UserRow, userTable } from "../../users/persistence/userTable.js"
import { type PasswordChallengeRow, passwordChallengeTable } from "./passwordChallengeTable.js"
import { type PasswordCredentialRow, passwordCredentialTable } from "./passwordCredentialTable.js"
import { type PasswordLockoutRow, passwordLockoutTable } from "./passwordLockoutTable.js"
import { type PasswordPolicyRow, passwordPolicyTable } from "./passwordPolicyTable.js"
import {
  type PasswordRegistrationChallengeRow,
  passwordRegistrationChallengeTable,
} from "./passwordRegistrationChallengeTable.js"

export function passwordRepositoryCreate(database: StorageExecutor) {
  return {
    passwordChallengeCreate(input: typeof passwordChallengeTable.$inferInsert): Result<PasswordChallengeRow> {
      try {
        const row = database.insert(passwordChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "passwordChallengeCreate",
            "The password challenge could not be created.",
            "passwords.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "passwordChallengeCreate",
          "The password challenge could not be created.",
          "passwords.write-failed",
        )
      }
    },

    passwordChallengeGet(realmId: string, tokenHash: string, kind: string): Result<PasswordChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordChallengeTable)
            .where(
              and(
                eq(passwordChallengeTable.realmId, realmId),
                eq(passwordChallengeTable.kind, kind),
                eq(passwordChallengeTable.tokenHash, tokenHash),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordChallengeGet",
          "The password challenge could not be read.",
          "passwords.read-failed",
        )
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
        return resultErrorCreate(
          "passwordChallengeConsume",
          "The password challenge could not be consumed.",
          "passwords.write-failed",
        )
      }
    },

    passwordChallengeExpirePrevious(realmId: string, userId: string, kind: string, consumedAt: number): Result<void> {
      try {
        database
          .update(passwordChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(passwordChallengeTable.realmId, realmId),
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
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeAttemptRecord(input: {
      attempts: number
      consumedAt: number | null
      expectedVersion: number
      id: string
      realmId: string
      version: number
    }): Result<PasswordRegistrationChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(passwordRegistrationChallengeTable)
            .set({ attempts: input.attempts, consumedAt: input.consumedAt, version: input.version })
            .where(
              and(
                eq(passwordRegistrationChallengeTable.id, input.id),
                eq(passwordRegistrationChallengeTable.realmId, input.realmId),
                eq(passwordRegistrationChallengeTable.version, input.expectedVersion),
                isNull(passwordRegistrationChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeAttemptRecord",
          "The registration code attempt could not be recorded.",
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeConsume(
      realmId: string,
      id: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<PasswordRegistrationChallengeRow | null> {
      try {
        return resultCreate(
          database
            .update(passwordRegistrationChallengeTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(passwordRegistrationChallengeTable.id, id),
                eq(passwordRegistrationChallengeTable.realmId, realmId),
                eq(passwordRegistrationChallengeTable.version, expectedVersion),
                isNull(passwordRegistrationChallengeTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeConsume",
          "The registration code could not be consumed.",
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeCreate(
      input: typeof passwordRegistrationChallengeTable.$inferInsert,
    ): Result<PasswordRegistrationChallengeRow> {
      try {
        const row = database.insert(passwordRegistrationChallengeTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "passwordRegistrationChallengeCreate",
            "The registration challenge could not be created.",
            "passwords.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeCreate",
          "The registration challenge could not be created.",
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeExpirePrevious(
      realmId: string,
      userId: string,
      purpose: string,
      consumedAt: number,
    ): Result<void> {
      try {
        database
          .update(passwordRegistrationChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(passwordRegistrationChallengeTable.realmId, realmId),
              eq(passwordRegistrationChallengeTable.userId, userId),
              eq(passwordRegistrationChallengeTable.purpose, purpose),
              isNull(passwordRegistrationChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeExpirePrevious",
          "The previous registration challenges could not be closed.",
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeExpirePreviousByIdentity(
      realmId: string,
      identityHash: string,
      purpose: string,
      consumedAt: number,
    ): Result<void> {
      try {
        database
          .update(passwordRegistrationChallengeTable)
          .set({ consumedAt })
          .where(
            and(
              eq(passwordRegistrationChallengeTable.realmId, realmId),
              eq(passwordRegistrationChallengeTable.identityHash, identityHash),
              eq(passwordRegistrationChallengeTable.purpose, purpose),
              isNull(passwordRegistrationChallengeTable.userId),
              isNull(passwordRegistrationChallengeTable.consumedAt),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeExpirePreviousByIdentity",
          "The previous registration decoy challenges could not be closed.",
          "passwords.write-failed",
        )
      }
    },

    passwordRegistrationChallengeGet(realmId: string, id: string): Result<PasswordRegistrationChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordRegistrationChallengeTable)
            .where(
              and(
                eq(passwordRegistrationChallengeTable.realmId, realmId),
                eq(passwordRegistrationChallengeTable.id, id),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeGet",
          "The registration challenge could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordRegistrationChallengeLatestDecoyGet(
      realmId: string,
      identityHash: string,
      purpose: string,
    ): Result<PasswordRegistrationChallengeRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordRegistrationChallengeTable)
            .where(
              and(
                eq(passwordRegistrationChallengeTable.realmId, realmId),
                eq(passwordRegistrationChallengeTable.identityHash, identityHash),
                eq(passwordRegistrationChallengeTable.purpose, purpose),
                isNull(passwordRegistrationChallengeTable.userId),
              ),
            )
            .orderBy(desc(passwordRegistrationChallengeTable.createdAt), desc(passwordRegistrationChallengeTable.id))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordRegistrationChallengeLatestDecoyGet",
          "The registration decoy challenge could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordCredentialCreate(input: typeof passwordCredentialTable.$inferInsert): Result<PasswordCredentialRow> {
      try {
        const row = database.insert(passwordCredentialTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "passwordCredentialCreate",
            "The password credential could not be created.",
            "passwords.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "passwordCredentialCreate",
          "The password credential could not be created.",
          "passwords.write-failed",
        )
      }
    },

    passwordCredentialGet(realmId: string, userId: string): Result<PasswordCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordCredentialTable)
            .where(and(eq(passwordCredentialTable.realmId, realmId), eq(passwordCredentialTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordCredentialGet",
          "The password credential could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordCredentialUpdate(
      realmId: string,
      userId: string,
      input: Partial<typeof passwordCredentialTable.$inferInsert>,
    ): Result<PasswordCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(passwordCredentialTable)
            .set(input)
            .where(and(eq(passwordCredentialTable.realmId, realmId), eq(passwordCredentialTable.userId, userId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordCredentialUpdate",
          "The password credential could not be updated.",
          "passwords.write-failed",
        )
      }
    },

    passwordEventVersionGet(realmId: string, userId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.realmId, realmId),
              eq(storageEventTable.aggregateId, userId),
              eq(storageEventTable.aggregateType, "password"),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate(
          "passwordEventVersionGet",
          "The password event version could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordLockoutGet(realmId: string, userId: string): Result<PasswordLockoutRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passwordLockoutTable)
            .where(and(eq(passwordLockoutTable.realmId, realmId), eq(passwordLockoutTable.userId, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordLockoutGet",
          "The password lockout state could not be read.",
          "passwords.read-failed",
        )
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
          return resultErrorCreate(
            "passwordLockoutSet",
            "The password lockout state could not be written.",
            "passwords.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "passwordLockoutSet",
          "The password lockout state could not be written.",
          "passwords.write-failed",
        )
      }
    },

    passwordPolicyGet(realmId: string): Result<PasswordPolicyRow | null> {
      try {
        return resultCreate(
          database.select().from(passwordPolicyTable).where(eq(passwordPolicyTable.realmId, realmId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordPolicyGet", "The password policy could not be read.", "passwords.read-failed")
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
            target: passwordPolicyTable.realmId,
          })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCreate(
            "passwordPolicySet",
            "The password policy could not be written.",
            "passwords.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "passwordPolicySet",
          "The password policy could not be written.",
          "passwords.write-failed",
        )
      }
    },

    passwordUserFindByIdentifier(realmId: string, identifier: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(
              and(
                eq(userTable.realmId, realmId),
                or(eq(userTable.email, identifier), sql`lower(trim(${userTable.userName})) = ${identifier}`),
              ),
            )
            .orderBy(asc(userTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordUserFindByIdentifier", "The user could not be read.", "passwords.read-failed")
      }
    },

    passwordUserFindByVerifiedIdentifier(realmId: string, identifier: string): Result<UserRow | null> {
      try {
        const emailForm = userEmailNormalize(identifier).success
        const email = emailForm
          ? userEmailRepositoryCreate(database).userEmailGetByVerifiedAddress(realmId, identifier)
          : resultCreate(null)
        if (!email.success)
          return resultErrorCreate(
            "passwordUserFindByVerifiedIdentifier",
            "The user could not be read.",
            "passwords.read-failed",
          )
        if (email.data !== null)
          return resultCreate(
            database
              .select()
              .from(userTable)
              .where(and(eq(userTable.realmId, realmId), eq(userTable.id, email.data.userId)))
              .get() ?? null,
          )
        const byUserName = database
          .select()
          .from(userTable)
          .where(and(eq(userTable.realmId, realmId), sql`lower(trim(${userTable.userName})) = ${identifier}`))
          .orderBy(asc(userTable.createdAt))
          .get()
        if (byUserName !== undefined) return resultCreate(byUserName)
        return resultCreate(null)
      } catch (_error) {
        return resultErrorCreate(
          "passwordUserFindByVerifiedIdentifier",
          "The user could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordUserFindByPhoneNumber(realmId: string, phoneNumber: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.realmId, realmId), eq(userTable.phoneNumber, phoneNumber)))
            .orderBy(asc(userTable.createdAt))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "passwordUserFindByPhoneNumber",
          "The user could not be read.",
          "passwords.read-failed",
        )
      }
    },

    passwordUserGet(realmId: string, userId: string): Result<UserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(userTable)
            .where(and(eq(userTable.realmId, realmId), eq(userTable.id, userId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passwordUserGet", "The user could not be read.", "passwords.read-failed")
      }
    },
  }
}
