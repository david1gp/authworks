import * as v from "valibot"

export const oidcDiscoverySchema = v.strictObject({
  authorization_endpoint: v.pipe(v.string(), v.url()),
  claims_supported: v.array(v.string()),
  code_challenge_methods_supported: v.array(v.literal("S256")),
  id_token_signing_alg_values_supported: v.array(v.literal("RS256")),
  issuer: v.pipe(v.string(), v.url()),
  jwks_uri: v.pipe(v.string(), v.url()),
  response_types_supported: v.array(v.literal("code")),
  scopes_supported: v.array(v.string()),
  subject_types_supported: v.array(v.literal("public")),
})

export type OidcDiscovery = v.InferOutput<typeof oidcDiscoverySchema>
