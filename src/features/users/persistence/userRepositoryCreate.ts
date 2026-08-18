import { and, asc, eq, ne } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
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

  return {
    userCreate(user: UserInsert, profile: UserProfileInsert): Result<UserRecord> {
      try {
        const created = database.insert(userTable).values(user).returning().get()
        if (created === undefined)
          return resultErrorCreate("userCreate", "The user could not be created.", "users.write-failed")
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
        const updated = database
          .update(userTable)
          .set(input)
          .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
          .returning()
          .get()
        if (updated === undefined) return resultCreate(null)
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
