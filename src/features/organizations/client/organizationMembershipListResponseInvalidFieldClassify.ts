import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationMembershipResourceIdSchema } from "../public/organizationMembershipResourceIdSchema.js"
import { organizationResourceIdSchema } from "../public/organizationResourceIdSchema.js"
import { organizationRolesSchema } from "../public/organizationRolesSchema.js"

type OrganizationMembershipListResponseInvalidField =
  | "envelope"
  | "items"
  | "id"
  | "realm-id"
  | "organization-id"
  | "user-id"
  | "created-at"
  | "updated-at"
  | "roles"
  | "next-page-token"
  | "unknown"

const timestampSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const userIdSchema = v.pipe(v.string(), v.minLength(1))
const envelopeFields = new Set(["items", "nextPageToken"])
const membershipFields = new Set(["createdAt", "id", "realmId", "organizationId", "roles", "updatedAt", "userId"])
const membershipFieldChecks = [
  ["createdAt", "created-at", timestampSchema],
  ["id", "id", organizationMembershipResourceIdSchema],
  ["realmId", "realm-id", realmResourceIdSchema],
  ["organizationId", "organization-id", organizationResourceIdSchema],
  ["roles", "roles", organizationRolesSchema],
  ["updatedAt", "updated-at", timestampSchema],
  ["userId", "user-id", userIdSchema],
] as const

export function organizationMembershipListResponseInvalidFieldClassify(
  body: unknown,
): OrganizationMembershipListResponseInvalidField {
  if (!recordCheck(body)) return "envelope"
  if (Object.keys(body).some((field) => !envelopeFields.has(field))) return "envelope"
  if (!Array.isArray(body.items)) return "items"
  for (const item of body.items) {
    if (!recordCheck(item)) return "items"
    if (Object.keys(item).some((field) => !membershipFields.has(field))) return "unknown"
    for (const [field, category, schema] of membershipFieldChecks) {
      if (!Object.hasOwn(item, field) || !v.safeParse(schema, item[field]).success) return category
    }
  }
  if (body.nextPageToken !== undefined && !v.safeParse(v.pipe(v.string(), v.minLength(1)), body.nextPageToken).success)
    return "next-page-token"
  return "unknown"
}

function recordCheck(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
