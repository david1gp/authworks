import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userTable } from "../persistence/userTable.js"

type UserSessionContextValidateOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function userSessionContextValidate(options: UserSessionContextValidateOptions): Result<void> {
  const op = "userSessionContextValidate"
  try {
    const user = options.executor
      .select({ id: userTable.id, state: userTable.state })
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, options.userId)))
      .get()
    if (user === undefined || user.state !== "active")
      return resultErrorCodedCreate(op, "The session organization context is invalid.", "users.unauthorized")
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The session organization context could not be read.", "users.read-failed")
  }
}
