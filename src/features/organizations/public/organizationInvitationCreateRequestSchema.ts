import * as v from "valibot"
import { organizationRolesSchema } from "../domain/organizationRolesSchema.js"

export const organizationInvitationCreateRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  roles: organizationRolesSchema,
})

export type OrganizationInvitationCreateRequest = v.InferOutput<typeof organizationInvitationCreateRequestSchema>
