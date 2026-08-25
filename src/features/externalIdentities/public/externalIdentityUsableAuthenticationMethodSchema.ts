import * as v from "valibot"

export const externalIdentityUsableAuthenticationMethodSchema = v.strictObject({ available: v.boolean() })

export type ExternalIdentityUsableAuthenticationMethod = v.InferOutput<
  typeof externalIdentityUsableAuthenticationMethodSchema
>
