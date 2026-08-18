import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"

export function organizationRolesNormalize(input: readonly OrganizationRoleId[]): Result<OrganizationRoleId[]> {
  const op = "organizationRolesNormalize"
  const roles = [...new Set(input)]
  if (roles.length === 0)
    return resultErrorCodedCreate(op, "At least one organization role is required.", "organizations.invalid")
  if (roles.length !== input.length)
    return resultErrorCodedCreate(op, "Organization roles must be unique.", "organizations.invalid")
  return resultCreate(roles.sort())
}
