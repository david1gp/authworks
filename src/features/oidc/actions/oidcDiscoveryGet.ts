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
    claims_supported: ["sub"],
    code_challenge_methods_supported: ["S256"],
    id_token_signing_alg_values_supported: ["RS256"],
    issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    scopes_supported: ["openid"],
    subject_types_supported: ["public"],
  })
}
