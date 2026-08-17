import { type Result } from "#result"
import * as v from "valibot"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { OrganizationRole } from "./organizationRoleSchema.js"
import { organizationRolesNormalize } from "./organizationRolesNormalize.js"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export function organizationRolesDecode(input: string): Result<OrganizationRole[]> {
  const op = "organizationRolesDecode"
  try {
    const parsed = JSON.parse(input) as unknown
    const validated = v.safeParse(organizationRolesSchema, parsed)
    if (!validated.success) return resultErrorCreate(op, "The stored organization roles are invalid.")
    return organizationRolesNormalize(validated.output as OrganizationRole[])
  } catch (_error) {
    return resultErrorCreate(op, "The stored organization roles are invalid.")
  }
}
