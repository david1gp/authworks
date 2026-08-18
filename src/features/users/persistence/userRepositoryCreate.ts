import { and, asc, eq, ne } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
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
      if (profile === undefined) return resultErrorCreate("userGet", "The user profile could not be read.")
      return resultCreate({ ...user, profile })
    } catch (_error) {
      return resultErrorCreate("userGet", "The user could not be read.")
    }
  }

  return {
    userCreate(user: UserInsert, profile: UserProfileInsert): Result<UserRecord> {
      try {
        const created = database.insert(userTable).values(user).returning().get()
        if (created === undefined) return resultErrorCreate("userCreate", "The user could not be created.")
        const createdProfile = database.insert(userProfileTable).values(profile).returning().get()
        if (createdProfile === undefined)
          return resultErrorCreate("userCreate", "The user profile could not be created.")
        return resultCreate({ ...created, profile: createdProfile })
      } catch (_error) {
        return resultErrorCreate("userCreate", "The user could not be created.")
      }
    },

    userGet(realmId: string, userId: string): Result<UserRecord | null> {
      return userRecordGet(realmId, userId)
    },

    userList(realmId: string): Result<UserRecord[]> {
      try {
        const users = database
          .select()
          .from(userTable)
          .where(and(eq(userTable.realmId, realmId), ne(userTable.state, "deleted")))
          .orderBy(asc(userTable.createdAt))
          .all()
        const records: UserRecord[] = []
        for (const user of users) {
          const profile = database.select().from(userProfileTable).where(eq(userProfileTable.userId, user.id)).get()
          if (profile === undefined) return resultErrorCreate("userList", "The user profile could not be read.")
          records.push({ ...user, profile })
        }
        return resultCreate(records)
      } catch (_error) {
        return resultErrorCreate("userList", "The users could not be read.")
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
        if (profile === undefined) return resultErrorCreate("userUpdate", "The user profile could not be read.")
        return resultCreate({ ...updated, profile })
      } catch (_error) {
        return resultErrorCreate("userUpdate", "The user could not be updated.")
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
        return resultErrorCreate("userProfileUpdate", "The user profile could not be updated.")
      }
    },
  }
}
