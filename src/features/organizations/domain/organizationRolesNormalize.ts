import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { OrganizationRole } from "./organizationRoleSchema.js"

export function organizationRolesNormalize(input: readonly OrganizationRole[]): Result<OrganizationRole[]> {
  const op = "organizationRolesNormalize"
  const roles = [...new Set(input)]
  if (roles.length === 0) return resultErrorCreate(op, "At least one organization role is required.")
  if (roles.length !== input.length) return resultErrorCreate(op, "Organization roles must be unique.")
  return resultCreate(roles.sort())
}
