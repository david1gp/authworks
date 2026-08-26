import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
}

export function userList(options: UserListOptions): Result<{ items: User[]; nextPageToken?: string }> {
  const op = "userList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The users are not available in this tenant context.", "users.tenant-mismatch")
  const users = userRepositoryCreate(options.database.db).userList(options.realmId)
  if (!users.success) return users
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (user) => user.id,
    query: options.query,
    rows: users.data.map(userPublicViewCreate),
    sortValueGet: (user) => (sortBy.data === "id" ? user.id : user.createdAt),
  })
}
