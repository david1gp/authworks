import * as v from "valibot"

export const userMetadataRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type UserMetadataRemoveResponse = v.InferOutput<typeof userMetadataRemoveResponseSchema>
