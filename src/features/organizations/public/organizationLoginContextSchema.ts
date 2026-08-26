import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationLoginContextSchema = v.strictObject({
  organizationId: v.optional(organizationResourceIdSchema),
  realmId: realmResourceIdSchema,
})

export type OrganizationLoginContext = v.InferOutput<typeof organizationLoginContextSchema>
