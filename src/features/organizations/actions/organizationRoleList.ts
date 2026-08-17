import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { organizationRoleDefinitions } from "../domain/organizationRoleDefinitions.js"
import type { OrganizationRoleListResponse } from "../public/organizationRoleListResponseSchema.js"

export function organizationRoleList(): { success: true; data: OrganizationRoleListResponse } {
  return resultCreate({ roles: organizationRoleDefinitions.map((role) => ({ ...role })) })
}
