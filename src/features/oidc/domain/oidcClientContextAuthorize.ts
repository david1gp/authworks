import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"

type OidcClientContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly realmId: string
}

export function oidcClientContextAuthorize(options: OidcClientContextAuthorizeOptions): Result<void> {
  const op = "oidcClientContextAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The OIDC resource is not available in this tenant context.")
  if (options.context.actor.assurance === "none" || options.context.actor.kind === "anonymous")
    return resultErrorCreate(op, "Authentication is required to manage OIDC resources.")
  return resultCreate(undefined)
}
