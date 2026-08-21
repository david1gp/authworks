import type { OidcDiscovery } from "../oidc/public/oidcDiscoverySchema.js"

const issuer = "https://auth.demo.example"

/** Read-only protocol metadata. Authworks derives it from the realm; it is never edited here. */
export const demoAdminOidcDiscovery: OidcDiscovery = {
  authorization_endpoint: `${issuer}/oauth/v2/authorize`,
  claims_supported: ["sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name", "preferred_username"],
  code_challenge_methods_supported: ["S256"],
  end_session_endpoint: `${issuer}/oidc/v1/end_session`,
  grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
  id_token_signing_alg_values_supported: ["RS256"],
  issuer,
  jwks_uri: `${issuer}/.well-known/jwks.json`,
  response_types_supported: ["code"],
  revocation_endpoint: `${issuer}/oauth/v2/revoke`,
  revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
  scopes_supported: ["openid", "profile", "email", "offline_access"],
  subject_types_supported: ["public"],
  token_endpoint: `${issuer}/oauth/v2/token`,
  token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
  userinfo_endpoint: `${issuer}/oidc/v1/userinfo`,
} satisfies OidcDiscovery
