import type { Context, MiddlewareHandler } from "hono"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../../authorization/public/authorizationPolicyRuleSchema.js"
import { sessionAuthenticate } from "../actions/sessionAuthenticate.js"
import type { Session } from "../public/sessionSchema.js"
import type { SessionAssurance } from "../public/sessionAssuranceSchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"

type SessionMiddlewareEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    session: Session
  }
}

type SessionProtectedMiddlewareOptions = {
  readonly database: StorageDatabase
  readonly minimumAssurance?: SessionAssurance
  readonly organizationId?: string
  readonly permission?: AuthorizationPermission
  readonly policies?: readonly AuthorizationPolicyRule[]
  readonly roles?: readonly string[]
}

export function sessionProtectedMiddlewareCreate(
  options: SessionProtectedMiddlewareOptions,
): MiddlewareHandler<SessionMiddlewareEnv> {
  return async (context, next) => {
    const authenticated = sessionAuthenticate({
      database: options.database,
      instanceId: context.req.param("instanceId") ?? "",
      token: sessionBearerTokenGet(context.req.header("authorization")),
    })
    if (!authenticated.success)
      return sessionMiddlewareErrorResponseCreate(context, authenticated.errorMessage, "unauthorized")
    const assurance = options.minimumAssurance
    if (assurance !== undefined && assuranceRankGet(authenticated.data.actor.assurance) < assuranceRankGet(assurance))
      return sessionMiddlewareErrorResponseCreate(context, "A stronger authentication is required.", "forbidden")
    if (options.permission !== undefined) {
      const authorization = authorizationEnforce({
        actor: authenticated.data.actor,
        instanceId: context.req.param("instanceId") ?? "",
        minimumAssurance: assurance,
        organizationId: options.organizationId,
        permission: options.permission,
        policies: options.policies,
        roles: options.roles,
      })
      if (!authorization.success)
        return sessionMiddlewareErrorResponseCreate(context, authorization.errorMessage, "forbidden")
    }
    context.set("authorizationActor", authenticated.data.actor)
    context.set("session", authenticated.data.session)
    return next()
  }
}

function sessionBearerTokenGet(authorization: string | undefined): string {
  if (authorization === undefined) return ""
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? ""
}

function assuranceRankGet(assurance: SessionAssurance): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}

function sessionMiddlewareErrorResponseCreate(
  context: Context<SessionMiddlewareEnv>,
  message: string,
  code: "forbidden" | "unauthorized",
) {
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as 401 | 403)
}
