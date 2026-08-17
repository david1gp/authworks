import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { OrganizationRole } from "./organizationRoleSchema.js"

export function organizationRoleAccessCheck(
  roles: readonly OrganizationRole[],
  required: OrganizationRole,
): Result<void> {
  const op = "organizationRoleAccessCheck"
  if (roles.includes("owner") || roles.includes("admin") || roles.includes(required)) return resultCreate(undefined)
  return resultErrorCreate(op, "The actor is not authorized for this organization.")
}
