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
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "userName", "lastSignInAt"], "createdAt")
  if (!sortBy.success) return sortBy
  let rows = users.data.map(userPublicViewCreate)
  const search = options.query?.search?.trim()
  if (search !== undefined && search.length > 0) rows = rows.filter((user) => userRecordMatchesSearch(user, search))
  return listRowsPage({
    idGet: (user) => user.id,
    nullsLast: sortBy.data === "lastSignInAt",
    query: options.query,
    rows,
    sortValueGet: (user) => userListSortValueGet(user, sortBy.data),
  })
}

function userListSortValueGet(user: User, sortBy: string): string | number | undefined {
  if (sortBy === "id") return user.id
  if (sortBy === "userName") return user.userName
  if (sortBy === "lastSignInAt") return user.lastSignInAt
  return user.createdAt
}

function userRecordMatchesSearch(user: User, search: string): boolean {
  const needle = search.toLowerCase()
  const haystacks = [
    user.userName,
    user.email,
    user.profile.displayName,
    user.profile.firstName,
    user.profile.lastName,
    user.profile.nickName,
  ]
  return haystacks.some((value) => value?.toLowerCase().includes(needle) === true)
}
