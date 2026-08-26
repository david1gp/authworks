import type { Context, MiddlewareHandler, Next } from "hono"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../../authorization/public/authorizationPolicyRuleSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { organizationMembershipContextValidate } from "../../organizations/server/organizationMembershipContextValidate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { sessionAuthenticate } from "../actions/sessionAuthenticate.js"
import { sessionBrowserCookieExtract } from "../domain/sessionBrowserCookieExtract.js"
import { sessionCsrfTokenValidate } from "../domain/sessionCsrfTokenValidate.js"
import { sessionRequestOriginValidate } from "../domain/sessionRequestOriginValidate.js"
import type { SessionAssuranceRequiredDetails } from "../public/sessionAssuranceRequiredDetailsSchema.js"
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
    const requestedOrganizationId = options.organizationId ?? context.req.param("organizationId")
    const expectedSessionOrganizationId =
      authenticated.data.session.organizationId === undefined ? undefined : requestedOrganizationId
    const organizationContext = organizationLoginContextValidate({
      context: {
        ...(authenticated.data.session.organizationId === undefined
          ? {}
          : { organizationId: authenticated.data.session.organizationId }),
        realmId: authenticated.data.session.realmId,
      },
      executor: options.database.db,
      ...(expectedSessionOrganizationId === undefined ? {} : { expectedOrganizationId: expectedSessionOrganizationId }),
      expectedRealmId: realmId,
    })
    if (!organizationContext.success)
      return sessionMiddlewareErrorResponseCreate(context, "Session authorization is invalid.", "unauthorized")
    const organizationId = organizationContext.data.organizationId ?? requestedOrganizationId
    if (
      requestedOrganizationId !== undefined &&
      organizationId !== undefined &&
      authenticated.data.actor.kind === "user"
    ) {
      const membership = organizationMembershipContextValidate({
        executor: options.database.db,
        organizationId,
        realmId,
        userId: authenticated.data.actor.actorId,
      })
      if (!membership.success)
        return sessionMiddlewareErrorResponseCreate(context, "Session authorization is invalid.", "unauthorized")
    }
    if (cookieAuthenticated && sessionRequestIsUnsafe(context.req.method)) {
      const origin = sessionRequestOriginValidate(context.req.raw, options.publicOrigin ?? defaultPublicOrigin)
      if (!origin.success || !origin.data)
        return sessionMiddlewareErrorResponseCreate(context, "The request origin is invalid.", "forbidden")
      const csrfCookie = sessionBrowserCookieExtract(context.req.header("cookie"), csrfCookieName)
      if (!csrfCookie.success || !sessionCsrfTokenValidate(context.req.header(csrfHeaderName), csrfCookie.data))
        return sessionMiddlewareErrorResponseCreate(context, "The CSRF token is invalid.", "forbidden")
    }
    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: options.database.db,
      organizationId,
      realmId,
    })
    if (!policy.success)
      return sessionMiddlewareErrorResponseCreate(context, "Session policy is unavailable.", "unauthorized")
    const assurance = assuranceStrongerGet(options.minimumAssurance, policy.data.minimumStepUpAssurance)
    if (assurance !== undefined && assuranceRankGet(authenticated.data.actor.assurance) < assuranceRankGet(assurance)) {
      const details: SessionAssuranceRequiredDetails = {
        action: "step_up",
        organizationId: organizationId ?? null,
        requiredAssurance: assurance,
      }
      return sessionMiddlewareErrorResponseCreate(
        context,
        "A stronger authentication is required.",
        "sessions.assurance-required",
        details,
      )
    }
    if (options.permission !== undefined) {
      const authorization = authorizationEnforce({
        actor: authenticated.data.actor,
        realmId: context.req.param("realmId") ?? "",
        minimumAssurance: assurance,
        organizationId,
        permission: options.permission,
        policies: options.policies,
        roles: options.roles,
      })
      if (!authorization.success) {
        if (authorization.code === "authorization.insufficient-assurance") {
          const requiredAssurance = assurance ?? "multi_factor"
          const details: SessionAssuranceRequiredDetails = {
            action: "step_up",
            organizationId: organizationId ?? null,
            requiredAssurance,
          }
          return sessionMiddlewareErrorResponseCreate(
            context,
            authorization.errorMessage,
            "sessions.assurance-required",
            details,
          )
        }
        return sessionMiddlewareErrorResponseCreate(context, authorization.errorMessage, "forbidden")
      }
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

function assuranceStrongerGet(
  left: SessionAssurance | undefined,
  right: SessionAssurance | undefined,
): SessionAssurance | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  return assuranceRankGet(left) >= assuranceRankGet(right) ? left : right
}

function sessionMiddlewareErrorResponseCreate(
  context: Context<SessionMiddlewareEnv>,
  message: string,
  code: "forbidden" | "unauthorized" | "sessions.assurance-required",
  details?: Readonly<Record<string, unknown>>,
) {
  if (code === "sessions.assurance-required")
    return context.json(
      httpErrorResponseCreate({ code, details, message, op: "sessionProtectedMiddlewareCreate", status: 403 }),
      403,
    )
  return context.json(httpErrorResponseCreate(code, message), httpErrorStatusGet(code) as 401 | 403)
}
