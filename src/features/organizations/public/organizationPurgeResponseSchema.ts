import * as v from "valibot"

export const organizationPurgeResponseSchema = v.strictObject({
  projectsDeleted: v.number(),
  purged: v.literal(true),
})

export type OrganizationPurgeResponse = v.InferOutput<typeof organizationPurgeResponseSchema>
