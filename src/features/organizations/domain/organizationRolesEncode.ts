import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationRole } from "./organizationRoleSchema.js"
import { organizationRolesNormalize } from "./organizationRolesNormalize.js"

export function organizationRolesEncode(input: readonly OrganizationRole[]): Result<string> {
  const roles = organizationRolesNormalize(input)
  if (!roles.success) return roles
  return resultCreate(JSON.stringify(roles.data))
}
