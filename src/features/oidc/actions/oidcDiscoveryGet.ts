import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { machineClientCredentialsSupported } from "../../machineUsers/actions/machineClientCredentialsSupported.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import { oidcResourceOwnerScope } from "../domain/oidcResourceOwnerScope.js"
import type { OidcDiscovery } from "../public/oidcDiscoverySchema.js"
import { oidcResourceOwnerClaim } from "../public/oidcResourceOwnerClaim.js"

type OidcDiscoveryGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
}

export function oidcDiscoveryGet(options: OidcDiscoveryGetOptions): Result<OidcDiscovery> {
  const op = "oidcDiscoveryGet"
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCodedCreate(op, "The realm is not active.", "oidc.not-active")
  const issuer = oidcIssuerCreate(realm.data.realm.domain)
  const machineCredentials = machineClientCredentialsSupported({
    database: options.database,
    realmId: options.realmId,
  })
  if (!machineCredentials.success) return machineCredentials
  const grantTypes: ("authorization_code" | "refresh_token" | "client_credentials")[] = machineCredentials.data
    ? ["authorization_code", "refresh_token", "client_credentials"]
    : ["authorization_code", "refresh_token"]
  return resultCreate({
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    claims_supported: [
      "act",
      "acr",
      "amr",
      "auth_time",
      "email",
      "email_verified",
      "family_name",
      "given_name",
      "locale",
      "name",
      "nickname",
      "nonce",
      "preferred_username",
      oidcResourceOwnerClaim,
      "sid",
      "sub",
    ],
    code_challenge_methods_supported: ["S256"],
    end_session_endpoint: `${issuer}/oauth2/logout`,
    grant_types_supported: grantTypes,
    id_token_signing_alg_values_supported: ["RS256"],
    issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    revocation_endpoint: `${issuer}/oauth2/revoke`,
    revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    scopes_supported: ["openid", "profile", "email", oidcResourceOwnerScope],
    subject_types_supported: ["public"],
    token_endpoint: `${issuer}/oauth2/token`,
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    userinfo_endpoint: `${issuer}/oauth2/userinfo`,
  })
}
