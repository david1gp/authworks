import * as v from "valibot"

export const passwordCredentialReplaceRequestSchema = v.strictObject({
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export type PasswordCredentialReplaceRequest = v.InferOutput<typeof passwordCredentialReplaceRequestSchema>
