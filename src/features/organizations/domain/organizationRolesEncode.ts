import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import { organizationRolesNormalize } from "./organizationRolesNormalize.js"

export function organizationRolesEncode(input: readonly OrganizationRoleId[]): Result<string> {
  const roles = organizationRolesNormalize(input)
  if (!roles.success) return roles
  return resultCreate(JSON.stringify(roles.data))
}
