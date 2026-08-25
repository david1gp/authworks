import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userEmailAddressContextValidate } from "../domain/userEmailAddressContextValidate.js"
import { userEmailAddressPublicViewCreate } from "../domain/userEmailAddressPublicViewCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressListResponse } from "../public/userEmailAddressListResponseSchema.js"

type UserEmailAddressListOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

export function userEmailAddressList(options: UserEmailAddressListOptions): Result<UserEmailAddressListResponse> {
  const op = "userEmailAddressList"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted" || user.data.deletedAt !== null)
    return resultErrorCreate(op, "The authenticated user is not available.", "users.not-found")
  const emails = userEmailRepositoryCreate(options.database.db).userEmailList(options.realmId, options.userId)
  if (!emails.success) return emails
  return resultCreate({ items: emails.data.map(userEmailAddressPublicViewCreate) })
}
