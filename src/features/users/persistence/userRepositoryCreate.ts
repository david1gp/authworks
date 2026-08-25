import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { userStateInvariantValidate } from "../domain/userStateInvariantValidate.js"
import { userEmailTable } from "./userEmailTable.js"
import { userEmailRepositoryCreate } from "./userEmailRepositoryCreate.js"
import { type UserProfileRow, userProfileTable } from "./userProfileTable.js"
import { type UserRow, userTable } from "./userTable.js"

type UserInsert = typeof userTable.$inferInsert
type UserUpdate = Partial<UserInsert>
type UserProfileInsert = typeof userProfileTable.$inferInsert
type UserProfileUpdate = Partial<UserProfileInsert>

export type UserRecord = UserRow & { profile: UserProfileRow }

export function userRepositoryCreate(database: StorageExecutor) {
  const userRecordGet = (realmId: string, userId: string): Result<UserRecord | null> => {
    try {
      const user = database
        .select()
        .from(userTable)
        .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
        .get()
      if (user === undefined) return resultCreate(null)
      const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, userId)).get()
      if (profile === undefined)
        return resultErrorCreate("userGet", "The user profile could not be read.", "users.read-failed")
      return resultCreate({ ...user, profile })
    } catch (_error) {
      return resultErrorCreate("userGet", "The user could not be read.", "users.read-failed")
    }
  }

  const userRecordGetByVerifiedPhoneNumber = (realmId: string, phoneNumber: string): Result<UserRecord | null> => {
    try {
      const user = database
        .select()
        .from(userTable)
        .where(
          and(
            eq(userTable.realmId, realmId),
            eq(userTable.phoneNumber, phoneNumber),
            isNotNull(userTable.phoneNumberVerifiedAt),
          ),
        )
        .get()
      if (user === undefined) return resultCreate(null)
      const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, user.id)).get()
      if (profile === undefined)
        return resultErrorCreate(
          "userGetByVerifiedPhoneNumber",
          "The user profile could not be read.",
          "users.read-failed",
        )
      return resultCreate({ ...user, profile })
    } catch (_error) {
      return resultErrorCreate("userGetByVerifiedPhoneNumber", "The user could not be read.", "users.read-failed")
    }
  }

  const userRecordGetByEmail = (realmId: string, email: string): Result<UserRecord | null> => {
    try {
      const user = database
        .select()
        .from(userTable)
        .where(and(eq(userTable.email, email), eq(userTable.realmId, realmId)))
        .get()
      if (user === undefined) return resultCreate(null)
      const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, user.id)).get()
      if (profile === undefined)
        return resultErrorCreate("userGetByEmail", "The user profile could not be read.", "users.read-failed")
      return resultCreate({ ...user, profile })
    } catch (_error) {
      return resultErrorCreate("userGetByEmail", "The user could not be read.", "users.read-failed")
    }
  }

  return {
    userCreate(user: UserInsert, profile: UserProfileInsert): Result<UserRecord> {
      const email = userEmailNormalize(user.email)
      if (!email.success) return email
      const normalizedUser = { ...user, email: email.data }
      const invariant = userStateInvariantValidate({
        emailVerifiedAt: normalizedUser.emailVerifiedAt ?? null,
        phoneNumber: normalizedUser.phoneNumber ?? null,
        phoneNumberVerifiedAt: normalizedUser.phoneNumberVerifiedAt ?? null,
        registrationVerifiedAt: normalizedUser.registrationVerifiedAt ?? null,
        registrationVerificationMethod: normalizedUser.registrationVerificationMethod ?? null,
      })
      if (!invariant.success)
        return resultErrorCreate("userCreate", invariant.errorMessage, invariant.code ?? "users.invalid-transition")
      try {
        const created = database.insert(userTable).values(normalizedUser).returning().get()
        if (created === undefined)
          return resultErrorCreate("userCreate", "The user could not be created.", "users.write-failed")
        const createdEmail = userEmailRepositoryCreate(database).userEmailCreate({
          createdAt: created.createdAt,
          email: created.email,
          id: created.id,
          isPrimary: true,
          realmId: created.realmId,
          updatedAt: created.updatedAt,
          userId: created.id,
          verifiedAt: created.emailVerifiedAt,
          version: 1,
        })
        if (!createdEmail.success) return createdEmail
        const createdProfile = database.insert(userProfileTable).values(profile).returning().get()
        if (createdProfile === undefined)
          return resultErrorCreate("userCreate", "The user profile could not be created.", "users.write-failed")
        return resultCreate({ ...created, profile: createdProfile })
      } catch (_error) {
        return resultErrorCreate("userCreate", "The user could not be created.", "users.write-failed")
      }
    },

    userGet(realmId: string, userId: string): Result<UserRecord | null> {
      return userRecordGet(realmId, userId)
    },

    userGetByEmail(realmId: string, email: string): Result<UserRecord | null> {
      return userRecordGetByEmail(realmId, email)
    },

    userGetByVerifiedPhoneNumber(realmId: string, phoneNumber: string): Result<UserRecord | null> {
      return userRecordGetByVerifiedPhoneNumber(realmId, phoneNumber)
    },

    userPhoneNumberChange(input: {
      expectedVersion: number
      phoneNumber: string
      phoneNumberVerifiedAt: number
      realmId: string
      updatedAt: number
      userId: string
      version: number
    }): Result<UserRecord | null> {
      try {
        const current = database
          .select()
          .from(userTable)
          .where(and(eq(userTable.id, input.userId), eq(userTable.realmId, input.realmId)))
          .get()
        if (current === undefined) return resultCreate(null)
        const invariant = userStateInvariantValidate({
          emailVerifiedAt: current.emailVerifiedAt,
          phoneNumber: input.phoneNumber,
          phoneNumberVerifiedAt: input.phoneNumberVerifiedAt,
          registrationVerifiedAt: current.registrationVerifiedAt,
          registrationVerificationMethod: current.registrationVerificationMethod,
        })
        if (!invariant.success)
          return resultErrorCreate(
            "userPhoneNumberChange",
            invariant.errorMessage,
            invariant.code ?? "users.invalid-transition",
          )
        const updated = database
          .update(userTable)
          .set({
            phoneNumber: input.phoneNumber,
            phoneNumberVerifiedAt: input.phoneNumberVerifiedAt,
            updatedAt: input.updatedAt,
            version: input.version,
          })
          .where(
            and(
              eq(userTable.id, input.userId),
              eq(userTable.realmId, input.realmId),
              eq(userTable.version, input.expectedVersion),
            ),
          )
          .returning()
          .get()
        if (updated === undefined) return resultCreate(null)
        const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, input.userId)).get()
        if (profile === undefined)
          return resultErrorCreate("userPhoneNumberChange", "The user profile could not be read.", "users.read-failed")
        return resultCreate({ ...updated, profile })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.toLowerCase().includes("unique"))
          return resultErrorCreate(
            "userPhoneNumberChange",
            "The user phone number is already verified by another user.",
            "users.conflict",
          )
        return resultErrorCreate(
          "userPhoneNumberChange",
          "The user phone number could not be changed.",
          "users.write-failed",
        )
      }
    },

    userEmailChange(input: {
      email: string
      emailVerifiedAt: number
      expectedVersion: number
      realmId: string
      updatedAt: number
      userId: string
      version: number
    }): Result<UserRecord | null> {
      const email = userEmailNormalize(input.email)
      if (!email.success) return email
      try {
        const updated = database
          .update(userTable)
          .set({
            email: email.data,
            emailVerifiedAt: input.emailVerifiedAt,
            updatedAt: input.updatedAt,
            version: input.version,
          })
          .where(
            and(
              eq(userTable.id, input.userId),
              eq(userTable.realmId, input.realmId),
              eq(userTable.version, input.expectedVersion),
            ),
          )
          .returning()
          .get()
        if (updated === undefined) return resultCreate(null)
        const primaryEmail = database
          .select()
          .from(userEmailTable)
          .where(
            and(
              eq(userEmailTable.realmId, input.realmId),
              eq(userEmailTable.userId, input.userId),
              eq(userEmailTable.isPrimary, true),
            ),
          )
          .get()
        if (primaryEmail === undefined)
          return resultErrorCreate("userEmailChange", "The primary user email could not be read.", "users.read-failed")
        const emailUpdated = database
          .update(userEmailTable)
          .set({
            email: email.data,
            updatedAt: input.updatedAt,
            verifiedAt: input.emailVerifiedAt,
            version: sql`${userEmailTable.version} + 1`,
          })
          .where(
            and(
              eq(userEmailTable.id, primaryEmail.id),
              eq(userEmailTable.realmId, input.realmId),
              eq(userEmailTable.userId, input.userId),
            ),
          )
          .returning()
          .get()
        if (emailUpdated === undefined)
          return resultErrorCreate("userEmailChange", "The user email could not be changed.", "users.write-failed")
        const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, input.userId)).get()
        if (profile === undefined)
          return resultErrorCreate("userEmailChange", "The user profile could not be read.", "users.read-failed")
        return resultCreate({ ...updated, profile })
      } catch (error: unknown) {
        if (error instanceof Error && error.message.toLowerCase().includes("unique"))
          return resultErrorCreate(
            "userEmailChange",
            "The user email is already used by another account.",
            "users.conflict",
          )
        return resultErrorCreate("userEmailChange", "The user email could not be changed.", "users.write-failed")
      }
    },

    userList(realmId: string): Result<UserRecord[]> {
      try {
        const users = database
          .select({ profile: userProfileTable, user: userTable })
          .from(userTable)
          .innerJoin(userProfileTable, eq(userProfileTable.userId, userTable.id))
          .where(and(eq(userTable.realmId, realmId), ne(userTable.state, "deleted")))
          .orderBy(asc(userTable.createdAt))
          .all()
        return resultCreate(users.map(({ profile, user }) => ({ ...user, profile })))
      } catch (_error) {
        return resultErrorCreate("userList", "The users could not be read.", "users.read-failed")
      }
    },

    userUpdate(realmId: string, userId: string, input: UserUpdate): Result<UserRecord | null> {
      try {
        const current = database
          .select()
          .from(userTable)
          .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
          .get()
        if (current === undefined) return resultCreate(null)
        const normalizedEmail =
          input.email === undefined ? resultCreate<string | undefined>(undefined) : userEmailNormalize(input.email)
        if (!normalizedEmail.success) return normalizedEmail
        const normalizedInput: UserUpdate =
          normalizedEmail.data === undefined ? input : { ...input, email: normalizedEmail.data }
        const emailChanged = normalizedInput.email !== undefined && normalizedInput.email !== current.email
        const phoneNumberChanged = input.phoneNumber !== undefined && input.phoneNumber !== current.phoneNumber
        if (
          current.phoneNumberVerifiedAt !== null &&
          phoneNumberChanged &&
          (input.phoneNumberVerifiedAt === undefined || input.phoneNumberVerifiedAt !== null)
        )
          return resultErrorCreate(
            "userUpdate",
            "The user verification state transition is invalid.",
            "users.invalid-transition",
          )
        const invariant = userStateInvariantValidate({
          emailVerifiedAt:
            normalizedInput.emailVerifiedAt === undefined ? current.emailVerifiedAt : normalizedInput.emailVerifiedAt,
          phoneNumber: input.phoneNumber === undefined ? current.phoneNumber : input.phoneNumber,
          phoneNumberVerifiedAt:
            input.phoneNumberVerifiedAt === undefined ? current.phoneNumberVerifiedAt : input.phoneNumberVerifiedAt,
          registrationVerifiedAt:
            normalizedInput.registrationVerifiedAt === undefined
              ? current.registrationVerifiedAt
              : normalizedInput.registrationVerifiedAt,
          registrationVerificationMethod:
            normalizedInput.registrationVerificationMethod === undefined
              ? current.registrationVerificationMethod
              : normalizedInput.registrationVerificationMethod,
        })
        if (!invariant.success)
          return resultErrorCreate("userUpdate", invariant.errorMessage, invariant.code ?? "users.invalid-transition")
        const updated = database
          .update(userTable)
          .set(normalizedInput)
          .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
          .returning()
          .get()
        if (updated === undefined) return resultCreate(null)
        if (
          emailChanged ||
          (normalizedInput.emailVerifiedAt !== undefined && normalizedInput.emailVerifiedAt !== current.emailVerifiedAt)
        ) {
          const primaryEmail = database
            .select()
            .from(userEmailTable)
            .where(
              and(
                eq(userEmailTable.realmId, realmId),
                eq(userEmailTable.userId, userId),
                eq(userEmailTable.isPrimary, true),
              ),
            )
            .get()
          if (primaryEmail === undefined)
            return resultErrorCreate("userUpdate", "The primary user email could not be read.", "users.read-failed")
          const emailUpdated = database
            .update(userEmailTable)
            .set({
              ...(emailChanged ? { email: updated.email } : {}),
              updatedAt: updated.updatedAt,
              verifiedAt: updated.emailVerifiedAt,
              version: sql`${userEmailTable.version} + 1`,
            })
            .where(
              and(
                eq(userEmailTable.id, primaryEmail.id),
                eq(userEmailTable.realmId, realmId),
                eq(userEmailTable.userId, userId),
              ),
            )
            .returning({ id: userEmailTable.id })
            .get()
          if (emailUpdated === undefined)
            return resultErrorCreate("userUpdate", "The user email could not be updated.", "users.write-failed")
        }
        const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, userId)).get()
        if (profile === undefined)
          return resultErrorCreate("userUpdate", "The user profile could not be read.", "users.read-failed")
        return resultCreate({ ...updated, profile })
      } catch (_error) {
        return resultErrorCreate("userUpdate", "The user could not be updated.", "users.write-failed")
      }
    },

    userProfileUpdate(realmId: string, userId: string, input: UserProfileUpdate): Result<UserRecord | null> {
      try {
        const profile = database
          .update(userProfileTable)
          .set(input)
          .where(and(eq(userProfileTable.userId, userId), eq(userProfileTable.realmId, realmId)))
          .returning()
          .get()
        if (profile === undefined) return resultCreate(null)
        const user = database
          .select()
          .from(userTable)
          .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
          .get()
        if (user === undefined) return resultCreate(null)
        return resultCreate({ ...user, profile })
      } catch (_error) {
        return resultErrorCreate("userProfileUpdate", "The user profile could not be updated.", "users.write-failed")
      }
    },
  }
}
