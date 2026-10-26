import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { User } from "../../users/public/userSchema.js"
import { directoryUserMatchesSearch } from "../domain/directoryUserMatchesSearch.js"
import type { DirectoryUserListQuery, DirectoryUserListResponse } from "../public/directoryUserListSchema.js"

type DirectoryEntrySortInput = {
  readonly entry: DirectoryUserListResponse["items"][number]
  readonly user: User
}

export function directoryEntrySortValueGet(
  entry: DirectoryEntrySortInput,
  sortBy: string,
): string | number | undefined {
  if (sortBy === "userName") return entry.user.userName
  if (sortBy === "lastSignInAt") return entry.user.lastSignInAt
  return entry.user.createdAt
}

export function directoryEntryListPageCreate(input: {
  readonly entries: readonly DirectoryUserListResponse["items"][number][]
  readonly usersById: ReadonlyMap<string, User>
  readonly query?: ListQuery | DirectoryUserListQuery
  readonly allowedSortBy?: readonly string[]
  readonly fallbackSortBy?: string
  readonly fallbackSortDirection?: "asc" | "desc"
}): Result<DirectoryUserListResponse> {
  const allowedSortBy = input.allowedSortBy ?? ["createdAt", "lastSignInAt", "userName"]
  const fallbackSortBy = input.fallbackSortBy ?? "lastSignInAt"
  const sortBy = listSortByResolve(input.query?.sortBy, allowedSortBy, fallbackSortBy)
  if (!sortBy.success) return sortBy
  const sortDirection =
    input.query?.sortDirection ?? input.fallbackSortDirection ?? (fallbackSortBy === "userName" ? "asc" : "desc")
  const search = input.query?.search?.trim()
  const state = input.query !== undefined && "state" in input.query ? input.query.state : undefined
  const emailVerified =
    input.query !== undefined && "emailVerified" in input.query ? input.query.emailVerified : undefined
  let entries = [...input.entries]
  if (search !== undefined && search.length > 0) {
    entries = entries.filter((entry) => {
      const user = input.usersById.get(entry.user.id)
      if (user === undefined) return false
      return directoryUserMatchesSearch(user, search)
    })
  }
  if (state !== undefined || emailVerified !== undefined) {
    entries = entries.filter((entry) => {
      const user = input.usersById.get(entry.user.id)
      if (user === undefined) return false
      if (state !== undefined && user.state !== state) return false
      if (emailVerified !== undefined && user.emailVerified !== emailVerified) return false
      return true
    })
  }
  const page = listRowsPage({
    idGet: (entry) => entry.user.id,
    nullsLast: sortBy.data === "lastSignInAt",
    query: input.query,
    rows: entries,
    sortDirection,
    sortValueGet: (entry) => {
      const user = input.usersById.get(entry.user.id)
      if (user === undefined) return undefined
      return directoryEntrySortValueGet({ entry, user }, sortBy.data)
    },
  })
  if (!page.success) return page
  return resultCreate(page.data)
}

export function directoryRoleFilterApply<
  TEntry extends {
    readonly memberships: readonly { readonly organizationId: string; readonly roles: readonly string[] }[]
  },
>(entries: readonly TEntry[], role: string | undefined, organizationId?: string): TEntry[] {
  if (role === undefined) return [...entries]
  return entries.filter((entry) =>
    entry.memberships.some(
      (membership) =>
        (organizationId === undefined || membership.organizationId === organizationId) &&
        membership.roles.includes(role),
    ),
  )
}

export function directoryListQueryValidate(query: unknown): Result<DirectoryUserListQuery> {
  const normalized = (query ?? {}) as Record<string, unknown>
  if (typeof normalized.role === "string" && normalized.role.trim().length === 0) {
    return resultErrorCodedCreate(
      "directoryListQueryValidate",
      "The directory role filter is invalid.",
      "directory.invalid",
    )
  }
  return resultCreate(normalized as DirectoryUserListQuery)
}
