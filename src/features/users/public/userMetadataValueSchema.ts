import * as v from "valibot"

// Zitadel stores metadata values as bytes; we store UTF-8 strings.
export const userMetadataValueSchema = v.pipe(v.string(), v.maxLength(4096))

export type UserMetadataValue = v.InferOutput<typeof userMetadataValueSchema>
