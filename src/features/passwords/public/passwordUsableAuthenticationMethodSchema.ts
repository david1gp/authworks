import * as v from "valibot"

export const passwordUsableAuthenticationMethodSchema = v.strictObject({ available: v.boolean() })

export type PasswordUsableAuthenticationMethod = v.InferOutput<typeof passwordUsableAuthenticationMethodSchema>
