import { and, eq, isNotNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userEmailTable } from "../persistence/userEmailTable.js"
import { userTable } from "../persistence/userTable.js"

type UserVerifiedEmailResolveOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function userVerifiedEmailResolve(options: UserVerifiedEmailResolveOptions): Result<string | null> {
  const user = options.executor
    .select({ id: userTable.id })
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, options.userId), eq(userTable.state, "active")))
    .get()
  if (user === undefined)
    return resultErrorCodedCreate("userVerifiedEmailResolve", "The user was not found.", "users.not-found")
  const email = options.executor
    .select({ email: userEmailTable.email })
    .from(userEmailTable)
    .where(
      and(
        eq(userEmailTable.realmId, options.realmId),
        eq(userEmailTable.userId, options.userId),
        eq(userEmailTable.isPrimary, true),
        isNotNull(userEmailTable.verifiedAt),
      ),
    )
    .get()
  return resultCreate(email?.email ?? null)
}
