import * as v from "valibot"

export const organizationMetadataKeySchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(128),
  v.regex(/^[A-Za-z0-9._:-]+$/),
)

export type OrganizationMetadataKey = v.InferOutput<typeof organizationMetadataKeySchema>
