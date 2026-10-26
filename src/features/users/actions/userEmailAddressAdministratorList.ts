import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/server/index.js"
import { userEmailAddressPublicViewCreate } from "../domain/userEmailAddressPublicViewCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressListResponse } from "../public/userEmailAddressListResponseSchema.js"

type UserEmailAddressAdministratorListOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

/** Reads another realm-local user's email rows after administrator authorization. */
export function userEmailAddressAdministratorList(
  options: UserEmailAddressAdministratorListOptions,
): Result<UserEmailAddressListResponse> {
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.userRead,
    realmId: options.realmId,
    targetUserId: options.userId,
  })
  if (!authorized.success) return authorized
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null)
    return resultErrorCreate("userEmailAddressAdministratorList", "The user was not found.", "users.not-found")
  const emails = userEmailRepositoryCreate(options.database.db).userEmailList(options.realmId, options.userId)
  if (!emails.success) return emails
  return resultCreate({ items: emails.data.map(userEmailAddressPublicViewCreate) })
}
