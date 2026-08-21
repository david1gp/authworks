import * as v from "valibot"

export const oidcAdminScreenSchema = v.picklist([
  "oidc-clients",
  "oidc-client-detail",
  "signing-keys",
  "oidc-consents",
  "protocol-documents",
])

export type OidcAdminScreen = v.InferOutput<typeof oidcAdminScreenSchema>
