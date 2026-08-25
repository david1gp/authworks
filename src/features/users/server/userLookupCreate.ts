import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type UserRecord, userRepositoryCreate } from "../persistence/userRepositoryCreate.js"

type UserLookup = {
  readonly deletedAt: number | null
  readonly id: string
  readonly phoneNumber: string | null
  readonly phoneNumberVerifiedAt: number | null
  readonly state: string
}

function userLookupViewCreate(user: UserRecord): UserLookup {
  return {
    deletedAt: user.deletedAt,
    id: user.id,
    phoneNumber: user.phoneNumber,
    phoneNumberVerifiedAt: user.phoneNumberVerifiedAt,
    state: user.state,
  }
}

export function userLookupCreate(database: StorageExecutor) {
  const repository = userRepositoryCreate(database)

  return {
    userFindByVerifiedPhoneNumber(realmId: string, phoneNumber: string): Result<UserLookup | null> {
      const user = repository.userGetByVerifiedPhoneNumber(realmId, phoneNumber)
      if (!user.success) return user
      return resultCreate(user.data === null ? null : userLookupViewCreate(user.data))
    },

    userGet(realmId: string, userId: string): Result<UserLookup | null> {
      const user = repository.userGet(realmId, userId)
      if (!user.success) return user
      return resultCreate(user.data === null ? null : userLookupViewCreate(user.data))
    },
  }
}
