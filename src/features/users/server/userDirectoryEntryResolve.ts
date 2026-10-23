import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"

type UserDirectoryEntryResolveOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

const userDirectoryNameSchema = v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))

export function userDirectoryEntryResolve(
  options: UserDirectoryEntryResolveOptions,
): Result<{ displayName?: string; email: string; userName: string } | undefined> {
  const op = "userDirectoryEntryResolve"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCreate(op, "The user directory lookup is invalid.", "users.invalid")
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted") return resultCreate(undefined)
  const parsed = v.safeParse(userDirectoryNameSchema, user.data.profile.displayName ?? undefined)
  const displayName = parsed.success ? parsed.output : undefined
  return resultCreate({
    ...(displayName === undefined ? {} : { displayName }),
    email: user.data.email,
    userName: user.data.userName,
  })
}
