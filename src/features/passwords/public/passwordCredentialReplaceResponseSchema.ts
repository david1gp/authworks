import * as v from "valibot"

export const passwordCredentialReplaceResponseSchema = v.strictObject({
  changed: v.boolean(),
})

export type PasswordCredentialReplaceResponse = v.InferOutput<typeof passwordCredentialReplaceResponseSchema>
