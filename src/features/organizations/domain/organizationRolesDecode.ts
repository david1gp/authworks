import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import { organizationRolesSchema } from "../public/organizationRolesSchema.js"
import { organizationRolesNormalize } from "./organizationRolesNormalize.js"

export function organizationRolesDecode(input: string): Result<OrganizationRoleId[]> {
  const op = "organizationRolesDecode"
  try {
    const parsed = JSON.parse(input) as unknown
    const validated = v.safeParse(organizationRolesSchema, parsed)
    if (!validated.success)
      return resultErrorCodedCreate(op, "The stored organization roles are invalid.", "organizations.event-invalid")
    return organizationRolesNormalize(validated.output as OrganizationRoleId[])
  } catch (_error) {
    return resultErrorCodedCreate(op, "The stored organization roles are invalid.", "organizations.event-invalid")
  }
}
