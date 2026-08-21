import type { Context, MiddlewareHandler, Next } from "hono"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../../authorization/public/authorizationPolicyRuleSchema.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { sessionAuthenticate } from "../actions/sessionAuthenticate.js"
import { sessionBrowserCookieExtract } from "../domain/sessionBrowserCookieExtract.js"
import { sessionCsrfTokenValidate } from "../domain/sessionCsrfTokenValidate.js"
import { sessionRequestOriginValidate } from "../domain/sessionRequestOriginValidate.js"
import type { SessionAssurance } from "../public/sessionAssuranceSchema.js"
import type { Session } from "../public/sessionSchema.js"

type SessionMiddlewareEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

type SessionProtectedMiddlewareOptions = {
  readonly database: StorageDatabase
  readonly fallback?: (context: Context<SessionMiddlewareEnv>, next: Next) => Promise<Response | void> | Response | void
  readonly minimumAssurance?: SessionAssurance
  readonly organizationId?: string
  readonly permission?: AuthorizationPermission
  readonly policies?: readonly AuthorizationPolicyRule[]
  readonly publicOrigin?: string
  readonly roles?: readonly string[]
}

const defaultPublicOrigin = "http://127.0.0.1:3000"
const sessionCookieName = "session"
const csrfCookieName = "csrf"
const csrfHeaderName = "x-csrf-token"

export function sessionProtectedMiddlewareCreate(
  options: SessionProtectedMiddlewareOptions,
): MiddlewareHandler<SessionMiddlewareEnv> {
  return async (context, next) => {
    const realmId = context.req.param("realmId") ?? ""
    const host = context.req.header("host") ?? new URL(context.req.url).hostname
    const tenant = realmTenantContextResolve({ database: options.database, host })
    if (tenant.success && tenant.data.realmId !== realmId)
      return sessionMiddlewareErrorResponseCreate(context, "Session authorization is invalid.", "unauthorized")
    const bearerToken = sessionBearerTokenGet(context.req.header("authorization"))
    const cookieAuthenticated = bearerToken === undefined
    let cookieToken: string | undefined
    if (cookieAuthenticated) {
      const extracted = sessionBrowserCookieExtract(context.req.header("cookie"), sessionCookieName)
      if (!extracted.success)
        return sessionMiddlewareErrorResponseCreate(context, extracted.errorMessage, "unauthorized")
      cookieToken = extracted.data
    }
    const authenticated = sessionAuthenticate({
      database: options.database,
      realmId,
      token: bearerToken ?? cookieToken ?? "",
    })
    if (!authenticated.success) {
      if (options.fallback !== undefined) return options.fallback(context, next)
      return sessionMiddlewareErrorResponseCreate(context, authenticated.errorMessage, "unauthorized")
    }
    if (cookieAuthenticated && sessionRequestIsUnsafe(context.req.method)) {
      const origin = sessionRequestOriginValidate(context.req.raw, options.publicOrigin ?? defaultPublicOrigin)
      if (!origin.success || !origin.data)
        return sessionMiddlewareErrorResponseCreate(context, "The request origin is invalid.", "forbidden")
      const csrfCookie = sessionBrowserCookieExtract(context.req.header("cookie"), csrfCookieName)
      if (!csrfCookie.success || !sessionCsrfTokenValidate(context.req.header(csrfHeaderName), csrfCookie.data))
        return sessionMiddlewareErrorResponseCreate(context, "The CSRF token is invalid.", "forbidden")
    }
    const assurance = options.minimumAssurance
    if (assurance !== undefined && assuranceRankGet(authenticated.data.actor.assurance) < assuranceRankGet(assurance))
      return sessionMiddlewareErrorResponseCreate(context, "A stronger authentication is required.", "forbidden")
    if (options.permission !== undefined) {
      const authorization = authorizationEnforce({
        actor: authenticated.data.actor,
        realmId: context.req.param("realmId") ?? "",
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
    context.set("cookieAuthenticated", cookieAuthenticated)
    context.set("session", authenticated.data.session)
    return next()
  }
}

function sessionBearerTokenGet(authorization: string | undefined): string | undefined {
  if (authorization === undefined) return undefined
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? ""
}

function sessionRequestIsUnsafe(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase())
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
