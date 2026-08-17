import * as v from "valibot"

export const organizationCreateRequestSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  ownerUserId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
})

export type OrganizationCreateRequest = v.InferOutput<typeof organizationCreateRequestSchema>
