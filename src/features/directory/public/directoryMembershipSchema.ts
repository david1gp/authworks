import * as v from "valibot"
import { organizationRolesSchema } from "../../organizations/public/organizationRolesSchema.js"

export const directoryMembershipSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  membershipId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.pipe(v.string(), v.minLength(1)),
  organizationName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  roles: organizationRolesSchema,
})

export type DirectoryMembership = v.InferOutput<typeof directoryMembershipSchema>
