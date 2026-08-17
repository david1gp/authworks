import * as v from "valibot"

export const organizationUpdateRequestSchema = v.strictObject({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type OrganizationUpdateRequest = v.InferOutput<typeof organizationUpdateRequestSchema>
