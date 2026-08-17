import * as v from "valibot"

export const passkeyCredentialRevokeRequestSchema = v.strictObject({
  credentialId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type PasskeyCredentialRevokeRequest = v.InferOutput<typeof passkeyCredentialRevokeRequestSchema>
