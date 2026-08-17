import * as v from "valibot"

export const externalIdentityUnlinkResponseSchema = v.strictObject({ removed: v.literal(true) })

export type ExternalIdentityUnlinkResponse = v.InferOutput<typeof externalIdentityUnlinkResponseSchema>
