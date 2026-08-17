import * as v from "valibot"

export const oidcConsentRevokeResponseSchema = v.strictObject({
  revoked: v.boolean(),
})

export type OidcConsentRevokeResponse = v.InferOutput<typeof oidcConsentRevokeResponseSchema>
