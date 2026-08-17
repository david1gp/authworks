import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"

type OidcClientContextAuthorizeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly instanceId: string
}

export function oidcClientContextAuthorize(options: OidcClientContextAuthorizeOptions): Result<void> {
  const op = "oidcClientContextAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The OIDC resource is not available in this tenant context.")
  if (options.context.actor.assurance === "none" || options.context.actor.kind === "anonymous")
    return resultErrorCreate(op, "Authentication is required to manage OIDC resources.")
  return resultCreate(undefined)
}
