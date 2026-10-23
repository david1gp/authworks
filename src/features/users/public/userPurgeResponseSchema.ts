import * as v from "valibot"

export const userPurgeResponseSchema = v.strictObject({ purged: v.literal(true) })

export type UserPurgeResponse = v.InferOutput<typeof userPurgeResponseSchema>
