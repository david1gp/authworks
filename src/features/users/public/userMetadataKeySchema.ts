import * as v from "valibot"

export const userMetadataKeySchema = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^[A-Za-z0-9._:-]+$/))

export type UserMetadataKey = v.InferOutput<typeof userMetadataKeySchema>
