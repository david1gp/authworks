import * as v from "valibot"

export const passkeyUsableAuthenticationMethodSchema = v.strictObject({ available: v.boolean() })

export type PasskeyUsableAuthenticationMethod = v.InferOutput<typeof passkeyUsableAuthenticationMethodSchema>
