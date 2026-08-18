import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"

export function organizationRoleAccessCheck(
  roles: readonly OrganizationRoleId[],
  required: OrganizationRoleId,
): Result<void> {
  const op = "organizationRoleAccessCheck"
  if (roles.includes("owner") || roles.includes("admin") || roles.includes(required)) return resultCreate(undefined)
  return resultErrorCodedCreate(op, "The actor is not authorized for this organization.", "organizations.forbidden")
}
