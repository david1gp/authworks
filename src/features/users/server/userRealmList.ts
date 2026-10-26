import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserRealmListOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly includeDeleted?: boolean
  readonly realmId: string
}

export function userRealmList(options: UserRealmListOptions): Result<User[]> {
  const op = "userRealmList"
  if (options.realmId.length === 0) return resultErrorCodedCreate(op, "The user lookup is invalid.", "users.invalid")
  const executor = "db" in options.database ? (options.database as StorageDatabase).db : options.database
  const users = userRepositoryCreate(executor).userList(
    options.realmId,
    options.includeDeleted === true ? { includeDeleted: true } : {},
  )
  if (!users.success) return users
  return resultCreate(users.data.map(userPublicViewCreate))
}
