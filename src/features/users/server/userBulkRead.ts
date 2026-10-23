import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserBulkReadOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly realmId: string
  readonly userIds: readonly string[]
}

export function userBulkRead(options: UserBulkReadOptions): Result<User[]> {
  const op = "userBulkRead"
  if (options.realmId.length === 0) return resultErrorCodedCreate(op, "The user lookup is invalid.", "users.invalid")
  if (options.userIds.length === 0) return resultCreate([])
  const executor = "db" in options.database ? (options.database as StorageDatabase).db : options.database
  const repository = userRepositoryCreate(executor)
  const users: User[] = []
  for (const userId of new Set(options.userIds)) {
    if (userId.length === 0) continue
    const user = repository.userGet(options.realmId, userId)
    if (!user.success) return user
    if (user.data === null) continue
    users.push(userPublicViewCreate(user.data))
  }
  users.sort((left, right) => left.id.localeCompare(right.id))
  return resultCreate(users)
}
