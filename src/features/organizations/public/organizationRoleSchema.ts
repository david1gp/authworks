import * as v from "valibot"
import { organizationRoleIdSchema } from "./organizationRoleIdSchema.js"

export const organizationRoleSchema = v.strictObject({
  id: organizationRoleIdSchema,
  name: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationRole = v.InferOutput<typeof organizationRoleSchema>
