import * as v from "valibot"
import { organizationSlugSchema } from "./organizationSlugSchema.js"

export const organizationUpdateRequestSchema = v.strictObject({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  slug: v.optional(organizationSlugSchema),
})

export type OrganizationUpdateRequest = v.InferOutput<typeof organizationUpdateRequestSchema>
