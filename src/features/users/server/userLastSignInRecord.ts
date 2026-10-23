import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userTable } from "../persistence/userTable.js"

export function userLastSignInRecord(options: {
  executor: StorageExecutor
  realmId: string
  userId: string
  signedInAt: number
}): Result<void> {
  const op = "userLastSignInRecord"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The user sign-in ownership is invalid.", "users.invalid")
  if (!Number.isSafeInteger(options.signedInAt) || options.signedInAt < 0)
    return resultErrorCodedCreate(op, "The user sign-in timestamp is invalid.", "users.invalid-timestamp")
  try {
    options.executor
      .update(userTable)
      .set({ lastSignInAt: options.signedInAt, updatedAt: options.signedInAt })
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, options.userId)))
      .run()
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The user sign-in could not be recorded.", "users.write-failed")
  }
}
