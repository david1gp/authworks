import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import { organizationRoleDefinitions } from "../domain/organizationRoleDefinitions.js"
import type { OrganizationRoleListResponse } from "../public/organizationRoleListResponseSchema.js"

export function organizationRoleList(query?: ListQuery): Result<OrganizationRoleListResponse> {
  const sortBy = listSortByResolve(query?.sortBy, ["createdAt", "id", "name"], "createdAt")
  if (!sortBy.success) return sortBy
  const roles = organizationRoleDefinitions.map((role, index) => ({ ...role, createdAt: index }))
  const page = listRowsPage({
    idGet: (role) => role.id,
    query,
    rows: roles,
    sortValueGet: (role) => {
      if (sortBy.data === "id") return role.id
      if (sortBy.data === "name") return role.name
      return role.createdAt
    },
  })
  if (!page.success) return page
  const result: OrganizationRoleListResponse = {
    items: page.data.items.map(({ createdAt: _createdAt, ...role }) => role),
  }
  if (page.data.nextPageToken !== undefined) result.nextPageToken = page.data.nextPageToken
  return resultCreate(result)
}
