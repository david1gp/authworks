import { and, eq, inArray } from "drizzle-orm"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userProfileTable } from "../persistence/userProfileTable.js"
import { userTable } from "../persistence/userTable.js"

/** Call only after authorizing access to the selected users in the given realm. */
export function userDisplayNameList(options: {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userIds: readonly string[]
}): Result<{ id: string; displayName: string | null }[]> {
  if (options.userIds.length === 0) return resultCreate([])
  try {
    return resultCreate(
      options.database.db
        .select({ id: userTable.id, displayName: userProfileTable.displayName, userName: userTable.userName })
        .from(userTable)
        .leftJoin(
          userProfileTable,
          and(eq(userProfileTable.userId, userTable.id), eq(userProfileTable.realmId, userTable.realmId)),
        )
        .where(and(eq(userTable.realmId, options.realmId), inArray(userTable.id, [...new Set(options.userIds)])))
        .all()
        .map((user) => ({ id: user.id, displayName: user.displayName?.trim() || user.userName })),
    )
  } catch (_error) {
    return resultErrorCodedCreate("userDisplayNameList", "User display names could not be read.", "users.read-failed")
  }
}
