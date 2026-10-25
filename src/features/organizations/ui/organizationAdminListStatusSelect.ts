import * as v from "valibot"
import { organizationListQuerySchema } from "../public/organizationListQuerySchema.js"
import type { OrganizationListQuery } from "../public/organizationListQuerySchema.js"

/** Reads the organization directory status filter from the URL query string. */
export function organizationAdminListStatusSelect(search: string): NonNullable<OrganizationListQuery["status"]> {
  const parsed = v.safeParse(organizationListQuerySchema, {
    status: new URLSearchParams(search).get("status"),
  })
  if (parsed.success && parsed.output.status !== undefined) return parsed.output.status
  return "active"
}
