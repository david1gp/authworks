import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import { instanceSystemContextCreate } from "../../instances/domain/instanceSystemContextCreate.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import type { OidcDiscovery } from "../public/oidcDiscoverySchema.js"

type OidcDiscoveryGetOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function oidcDiscoveryGet(options: OidcDiscoveryGetOptions): Result<OidcDiscovery> {
  const op = "oidcDiscoveryGet"
  const instance = instanceGet({
    context: instanceSystemContextCreate(),
    database: options.database,
    instanceId: options.instanceId,
  })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const issuer = oidcIssuerCreate(instance.data.instance.domain)
  return resultCreate({
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    claims_supported: [
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
      "sub",
    ],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    id_token_signing_alg_values_supported: ["RS256"],
    issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    revocation_endpoint: `${issuer}/oauth2/revoke`,
    revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    scopes_supported: ["openid", "profile", "email"],
    subject_types_supported: ["public"],
    token_endpoint: `${issuer}/oauth2/token`,
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    userinfo_endpoint: `${issuer}/oauth2/userinfo`,
  })
}
