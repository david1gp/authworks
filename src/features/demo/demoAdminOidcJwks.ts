import type { OidcJwks } from "../oidc/public/oidcJwksSchema.js"
import { demoAdminOidcSigningKeys } from "./demoAdminOidcSigningKeys.js"

/** The published JWKS only ever contains active public keys, never private material. */
export const demoAdminOidcJwks: OidcJwks = {
  keys: demoAdminOidcSigningKeys.filter((key) => key.status === "active").map((key) => key.publicJwk),
} satisfies OidcJwks
