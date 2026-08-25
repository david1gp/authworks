import { and, asc, eq, isNotNull, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { type UserEmailRow, userEmailTable } from "./userEmailTable.js"
import { userTable } from "./userTable.js"

type UserEmailInsert = typeof userEmailTable.$inferInsert

export function userEmailRepositoryCreate(database: StorageExecutor) {
  const userEmailGet = (realmId: string, userId: string, emailId: string): Result<UserEmailRow | null> => {
    try {
      return resultCreate(
        database
          .select()
          .from(userEmailTable)
          .where(
            and(eq(userEmailTable.id, emailId), eq(userEmailTable.realmId, realmId), eq(userEmailTable.userId, userId)),
          )
          .get() ?? null,
      )
    } catch (_error) {
      return resultErrorCreate("userEmailGet", "The user email could not be read.", "users.read-failed")
    }
  }

  const userEmailPrimaryGet = (realmId: string, userId: string): Result<UserEmailRow | null> => {
    try {
      return resultCreate(
        database
          .select()
          .from(userEmailTable)
          .where(
            and(
              eq(userEmailTable.realmId, realmId),
              eq(userEmailTable.userId, userId),
              eq(userEmailTable.isPrimary, true),
            ),
          )
          .get() ?? null,
      )
    } catch (_error) {
      return resultErrorCreate("userEmailPrimaryGet", "The primary user email could not be read.", "users.read-failed")
    }
  }

  const userEmailProjectionSet = (row: UserEmailRow): Result<void> => {
    try {
      const updated = database
        .update(userTable)
        .set({
          email: row.email,
          emailVerifiedAt: row.verifiedAt,
          updatedAt: row.updatedAt,
          version: sql`${userTable.version} + 1`,
        })
        .where(and(eq(userTable.id, row.userId), eq(userTable.realmId, row.realmId)))
        .returning({ id: userTable.id })
        .get()
      if (updated === undefined)
        return resultErrorCreate(
          "userEmailProjectionSet",
          "The user email projection could not be updated.",
          "users.write-failed",
        )
      return resultCreate(undefined)
    } catch (error: unknown) {
      if (error instanceof Error && error.message.toLowerCase().includes("identifier collision"))
        return resultErrorCreate(
          "userEmailProjectionSet",
          "The user email is already used by another account.",
          "users.conflict",
        )
      return resultErrorCreate(
        "userEmailProjectionSet",
        "The user email projection could not be updated.",
        "users.write-failed",
      )
    }
  }

  return {
    userEmailCreate(input: UserEmailInsert): Result<UserEmailRow> {
      const email = userEmailNormalize(input.email)
      if (!email.success) return email
      try {
        const user = database
          .select({ email: userTable.email, emailVerifiedAt: userTable.emailVerifiedAt, id: userTable.id })
          .from(userTable)
          .where(and(eq(userTable.id, input.userId), eq(userTable.realmId, input.realmId)))
          .get()
        if (user === undefined)
          return resultErrorCreate("userEmailCreate", "The user was not found.", "users.not-found")

        const primary = userEmailPrimaryGet(input.realmId, input.userId)
        if (!primary.success) return primary
        if (input.isPrimary && primary.data !== null)
          return resultErrorCreate("userEmailCreate", "The user already has a primary email.", "users.conflict")
        if (!input.isPrimary && primary.data === null)
          return resultErrorCreate("userEmailCreate", "The user must have a primary email.", "users.invalid-transition")
        if (input.isPrimary && primary.data === null) {
          const existing = database
            .select({ id: userEmailTable.id })
            .from(userEmailTable)
            .where(and(eq(userEmailTable.realmId, input.realmId), eq(userEmailTable.userId, input.userId)))
            .get()
          if (existing !== undefined && input.verifiedAt === null)
            return resultErrorCreate(
              "userEmailCreate",
              "Only a verified user email can become primary.",
              "users.invalid-transition",
            )
        }

        const row = database
          .insert(userEmailTable)
          .values({ ...input, email: email.data })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCreate("userEmailCreate", "The user email could not be created.", "users.write-failed")
        if (row.isPrimary && (user.email !== row.email || user.emailVerifiedAt !== row.verifiedAt)) {
          const projection = userEmailProjectionSet(row)
          if (!projection.success) return projection
        }
        return resultCreate(row)
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.toLowerCase().includes("unique") ||
            error.message.toLowerCase().includes("identifier collision"))
        )
          return resultErrorCreate(
            "userEmailCreate",
            "The user email is already used by another account.",
            "users.conflict",
          )
        return resultErrorCreate("userEmailCreate", "The user email could not be created.", "users.write-failed")
      }
    },

    userEmailDelete(
      realmId: string,
      userId: string,
      emailId: string,
      expectedVersion?: number,
    ): Result<UserEmailRow | null> {
      const current = userEmailGet(realmId, userId, emailId)
      if (!current.success) return current
      if (current.data === null) return resultCreate(null)
      if (current.data.isPrimary)
        return resultErrorCreate("userEmailDelete", "The primary user email cannot be removed.", "users.conflict")
      try {
        return resultCreate(
          database
            .delete(userEmailTable)
            .where(
              and(
                eq(userEmailTable.id, emailId),
                eq(userEmailTable.realmId, realmId),
                eq(userEmailTable.userId, userId),
                eq(userEmailTable.isPrimary, false),
                ...(expectedVersion === undefined ? [] : [eq(userEmailTable.version, expectedVersion)]),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("userEmailDelete", "The user email could not be removed.", "users.write-failed")
      }
    },

    userEmailGet(realmId: string, userId: string, emailId: string): Result<UserEmailRow | null> {
      return userEmailGet(realmId, userId, emailId)
    },

    userEmailGetByUserAddress(realmId: string, userId: string, address: string): Result<UserEmailRow | null> {
      const email = userEmailNormalize(address)
      if (!email.success) return email
      try {
        return resultCreate(
          database
            .select()
            .from(userEmailTable)
            .where(
              and(
                eq(userEmailTable.realmId, realmId),
                eq(userEmailTable.userId, userId),
                eq(userEmailTable.email, email.data),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("userEmailGetByUserAddress", "The user email could not be read.", "users.read-failed")
      }
    },

    userEmailGetByVerifiedAddress(realmId: string, address: string): Result<UserEmailRow | null> {
      const email = userEmailNormalize(address)
      if (!email.success) return email
      try {
        return resultCreate(
          database
            .select()
            .from(userEmailTable)
            .where(
              and(
                eq(userEmailTable.realmId, realmId),
                eq(userEmailTable.email, email.data),
                isNotNull(userEmailTable.verifiedAt),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "userEmailGetByVerifiedAddress",
          "The verified user email could not be read.",
          "users.read-failed",
        )
      }
    },

    userEmailList(realmId: string, userId: string): Result<UserEmailRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(userEmailTable)
            .where(and(eq(userEmailTable.realmId, realmId), eq(userEmailTable.userId, userId)))
            .orderBy(asc(userEmailTable.createdAt), asc(userEmailTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("userEmailList", "The user emails could not be read.", "users.read-failed")
      }
    },

    userEmailPrimaryGet(realmId: string, userId: string): Result<UserEmailRow | null> {
      return userEmailPrimaryGet(realmId, userId)
    },

    userEmailPrimarySet(input: {
      emailId: string
      expectedVersion: number
      realmId: string
      updatedAt: number
      userId: string
      version: number
    }): Result<UserEmailRow | null> {
      const current = userEmailGet(input.realmId, input.userId, input.emailId)
      if (!current.success) return current
      if (current.data === null) return resultCreate(null)
      if (current.data.verifiedAt === null)
        return resultErrorCreate(
          "userEmailPrimarySet",
          "Only a verified user email can become primary.",
          "users.invalid-transition",
        )
      if (current.data.version !== input.expectedVersion) return resultCreate(null)
      if (current.data.isPrimary) return resultCreate(current.data)
      try {
        const primary = userEmailPrimaryGet(input.realmId, input.userId)
        if (!primary.success) return primary
        if (primary.data !== null)
          database
            .update(userEmailTable)
            .set({ isPrimary: false, updatedAt: input.updatedAt, version: sql`${userEmailTable.version} + 1` })
            .where(
              and(
                eq(userEmailTable.id, primary.data.id),
                eq(userEmailTable.realmId, input.realmId),
                eq(userEmailTable.userId, input.userId),
              ),
            )
            .run()
        const promoted = database
          .update(userEmailTable)
          .set({ isPrimary: true, updatedAt: input.updatedAt, version: input.version })
          .where(
            and(
              eq(userEmailTable.id, input.emailId),
              eq(userEmailTable.realmId, input.realmId),
              eq(userEmailTable.userId, input.userId),
              eq(userEmailTable.version, input.expectedVersion),
            ),
          )
          .returning()
          .get()
        if (promoted === undefined) return resultCreate(null)
        const projection = userEmailProjectionSet(promoted)
        if (!projection.success) return projection
        return resultCreate(promoted)
      } catch (_error) {
        return resultErrorCreate(
          "userEmailPrimarySet",
          "The primary user email could not be changed.",
          "users.write-failed",
        )
      }
    },

    userEmailVerificationSet(input: {
      emailId: string
      expectedVersion: number
      realmId: string
      updatedAt: number
      userId: string
      verifiedAt: number | null
      version: number
    }): Result<UserEmailRow | null> {
      try {
        const updated = database
          .update(userEmailTable)
          .set({ updatedAt: input.updatedAt, verifiedAt: input.verifiedAt, version: input.version })
          .where(
            and(
              eq(userEmailTable.id, input.emailId),
              eq(userEmailTable.realmId, input.realmId),
              eq(userEmailTable.userId, input.userId),
              eq(userEmailTable.version, input.expectedVersion),
            ),
          )
          .returning()
          .get()
        if (updated === undefined) return resultCreate(null)
        if (updated.isPrimary) {
          const projection = userEmailProjectionSet(updated)
          if (!projection.success) return projection
        }
        return resultCreate(updated)
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.toLowerCase().includes("unique") ||
            error.message.toLowerCase().includes("identifier collision"))
        )
          return resultErrorCreate(
            "userEmailVerificationSet",
            "The user email is already used by another account.",
            "users.conflict",
          )
        return resultErrorCreate(
          "userEmailVerificationSet",
          "The user email verification could not be changed.",
          "users.write-failed",
        )
      }
    },
  }
}
