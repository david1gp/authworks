import * as v from "valibot"

// Zitadel stores metadata values as bytes; we store UTF-8 strings.
export const organizationMetadataValueSchema = v.pipe(v.string(), v.maxLength(4096))

export type OrganizationMetadataValue = v.InferOutput<typeof organizationMetadataValueSchema>
