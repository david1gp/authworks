import type { MiddlewareHandler } from "hono"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { instanceTenantContextResolve } from "../../instances/actions/instanceTenantContextResolve.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { machineCredentialAuthenticate } from "../actions/machineCredentialAuthenticate.js"
import type { MachineCredentialAuthentication } from "../domain/machineCredentialAuthentication.js"

export type MachineProtectedMiddlewareEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    machineAuthentication: MachineCredentialAuthentication
  }
}

type MachineProtectedMiddlewareOptions = {
  readonly database: StorageDatabase
  readonly permission?: AuthorizationPermission
}

export function machineProtectedMiddlewareCreate(
  options: MachineProtectedMiddlewareOptions,
): MiddlewareHandler<MachineProtectedMiddlewareEnv> {
  return async (context, next) => {
    const instanceId = context.req.param("instanceId") ?? ""
    const host = context.req.header("host") ?? new URL(context.req.url).hostname
    const tenant = instanceTenantContextResolve({ database: options.database, host })
    if (tenant.success && tenant.data.instanceId !== instanceId)
      return context.json(
        httpErrorResponseCreate("unauthorized", "Machine authorization is invalid."),
        httpErrorStatusGet("unauthorized") as 401,
      )
    const authenticated = machineCredentialAuthenticate({
      database: options.database,
      instanceId,
      token: machineTokenGet(context.req.header("authorization"), context.req.header("x-api-key")),
    })
    if (!authenticated.success)
      return context.json(
        httpErrorResponseCreate("unauthorized", authenticated.errorMessage),
        httpErrorStatusGet("unauthorized") as 401,
      )
    if (options.permission !== undefined) {
      const authorized = authorizationEnforce({
        actor: authenticated.data.actor,
        instanceId,
        permission: options.permission,
      })
      if (!authorized.success)
        return context.json(
          httpErrorResponseCreate("forbidden", authorized.errorMessage),
          httpErrorStatusGet("forbidden") as 403,
        )
    }
    context.set("authorizationActor", authenticated.data.actor)
    context.set("machineAuthentication", authenticated.data)
    return next()
  }
}

function machineTokenGet(authorization: string | undefined, apiKey: string | undefined): string {
  if (apiKey !== undefined && apiKey.length > 0) return apiKey
  if (authorization === undefined) return ""
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? ""
}
