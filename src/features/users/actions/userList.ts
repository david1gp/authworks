import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { realmAdministratorIs } from "../../realms/server/index.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserListQuery } from "../public/userListQuerySchema.js"
import type { User } from "../public/userSchema.js"

type UserListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery | UserListQuery
}

export function userList(options: UserListOptions): Result<{ items: User[]; nextPageToken?: string }> {
  const op = "userList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The users are not available in this tenant context.", "users.tenant-mismatch")
  const queryState = options.query !== undefined && "state" in options.query ? options.query.state : undefined
  const deletedOnly = queryState === "deleted"
  if (deletedOnly) {
    const allowed = userListDeletedAccessCheck({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
    })
    if (!allowed.success) return allowed
  }
  const users = userRepositoryCreate(options.database.db).userList(options.realmId, {
    ...(deletedOnly ? { includeDeleted: true as const, onlyDeleted: true as const } : {}),
  })
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

function userListDeletedAccessCheck(options: {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}): Result<void> {
  const op = "userList"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.actor.kind === "bootstrap_admin") return resultCreate(undefined)
  if (options.context.actor.kind !== "user")
    return resultErrorCreate(op, "Only realm administrators can list deleted users.", "users.forbidden")
  const administrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!administrator.success) return administrator
  if (!administrator.data)
    return resultErrorCreate(op, "Only realm administrators can list deleted users.", "users.forbidden")
  return resultCreate(undefined)
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
