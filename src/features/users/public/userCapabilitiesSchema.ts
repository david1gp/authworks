import * as v from "valibot"

export const userCapabilitiesSchema = v.strictObject({ realmRead: v.boolean() })

export type UserCapabilities = v.InferOutput<typeof userCapabilitiesSchema>
