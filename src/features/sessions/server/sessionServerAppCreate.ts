import { Hono } from "hono"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { sessionAdministratorList } from "../actions/sessionAdministratorList.js"
import { sessionAdministratorRevoke } from "../actions/sessionAdministratorRevoke.js"
import { sessionBootstrapAdminSignIn } from "../actions/sessionBootstrapAdminSignIn.js"
import { sessionList } from "../actions/sessionList.js"
import { sessionMeList } from "../actions/sessionMeList.js"
import { sessionRecentList } from "../actions/sessionRecentList.js"
import { sessionRevoke } from "../actions/sessionRevoke.js"
import { sessionRevokeAll } from "../actions/sessionRevokeAll.js"
import { sessionRotate } from "../actions/sessionRotate.js"
import { sessionBrowserCookieSerialize } from "../domain/sessionBrowserCookieSerialize.js"
import { sessionBrowserCookieTokenGet } from "../domain/sessionBrowserCookieTokenGet.js"
import { sessionCsrfTokenCreate } from "../domain/sessionCsrfTokenCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionRequestOriginValidate } from "../domain/sessionRequestOriginValidate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import { sessionBootstrapAdminSignInRequestSchema } from "../public/sessionBootstrapAdminSignInRequestSchema.js"
import type { SessionDeviceMetadata } from "../public/sessionDeviceMetadataSchema.js"
import { sessionRevokeAllRequestSchema } from "../public/sessionRevokeAllRequestSchema.js"
import type { Session } from "../public/sessionSchema.js"
import type { SessionSubjectType } from "../public/sessionSubjectTypeSchema.js"
import { sessionBrowserCredentialResponseCreate } from "./sessionBrowserCredentialResponseCreate.js"
import { sessionProtectedMiddlewareCreate } from "./sessionProtectedMiddlewareCreate.js"

type SessionServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

type SessionServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
}

export function sessionServerAppCreate(options: SessionServerAppCreateOptions) {
  const app = new Hono<SessionServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.post("/realms/:realmId/admin/sign-in", async (context) => {
    const origin = sessionRequestOriginValidate(context.req.raw, options.publicOrigin ?? "http://127.0.0.1:3000")
    if (!origin.success || !origin.data)
      return sessionErrorResponseCreate(context, {
        code: "sessions.forbidden",
        errorMessage: "The request origin is invalid.",
        op: "sessionBootstrapAdminSignIn",
        success: false,
      })
    const tenant = sessionTenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success || tenant.data.realmId !== context.req.param("realmId"))
      return sessionErrorResponseCreate(context, {
        code: "sessions.unauthorized",
        errorMessage: "The bootstrap administrator credentials are invalid.",
        op: "sessionBootstrapAdminSignIn",
        success: false,
      })
    const body = await sessionRequestJsonRead(context)
    if (!body.success) return sessionErrorResponseCreate(context, body)
    const input = v.safeParse(sessionBootstrapAdminSignInRequestSchema, body.data)
    if (!input.success)
      return sessionErrorResponseCreate(context, {
        code: "sessions.unauthorized",
        errorMessage: "The bootstrap administrator credentials are invalid.",
        op: "sessionBootstrapAdminSignIn",
        success: false,
      })
    const signedIn = sessionBootstrapAdminSignIn({
      context: tenant.data,
      database: options.database,
      deviceMetadata: sessionDeviceMetadataGet(context),
      secret: input.output.secret,
    })
    const browser = sessionBrowserCredentialResponseCreate(context, signedIn)
    return sessionResultResponseCreate(context, browser)
  })

  app.get("/realms/:realmId/sessions/csrf", protectedMiddleware, (context) => {
    const token = sessionCsrfTokenCreate(options.database.runtime)
    const serialized = sessionBrowserCookieSerialize("csrf", token)
    if (!serialized.success) return sessionErrorResponseCreate(context, serialized)
    context.header("set-cookie", serialized.data)
    return context.json({ csrfToken: token })
  })

  app.get("/realms/:realmId/sessions/current", protectedMiddleware, (context) =>
    sessionCurrentRoute(context, options.database),
  )

  app.get("/realms/:realmId/sessions", protectedMiddleware, (context) => sessionListRoute(context, options.database))

  app.get("/realms/:realmId/users/:userId/sessions", protectedMiddleware, (context) =>
    sessionAdministratorListRoute(context, options.database),
  )

  app.get("/realms/:realmId/me/sessions", protectedMiddleware, (context) =>
    sessionMeListRoute(context, options.database),
  )

  app.get("/realms/:realmId/sessions/recent", protectedMiddleware, (context) =>
    sessionRecentListRoute(context, options.database),
  )

  app.post("/realms/:realmId/sessions/rotate", protectedMiddleware, (context) =>
    sessionRotateRoute(context, options.database),
  )

  const sessionLogoutRoute = (context: SessionRouteContext) => {
    if (!context.get("cookieAuthenticated"))
      return sessionErrorResponseCreate(context, {
        code: "sessions.unauthorized",
        errorMessage: "Cookie authorization is required.",
        op: "sessionLogout",
        success: false,
      })
    const revoked = sessionRevoke({
      database: options.database,
      realmId: context.req.param("realmId"),
      sessionId: context.get("session").id,
      subjectType: sessionSubjectTypeGet(context.get("authorizationActor")),
      userId: context.get("authorizationActor").actorId,
    })
    if (!revoked.success) return sessionErrorResponseCreate(context, revoked)
    const serialized = sessionBrowserCookieSerialize("session", "", {
      expires: new Date(0),
      maxAge: 0,
    })
    if (!serialized.success) return sessionErrorResponseCreate(context, serialized)
    context.header("set-cookie", serialized.data)
    return sessionResultResponseCreate(context, revoked)
  }
  app.post("/realms/:realmId/sessions/logout", protectedMiddleware, sessionLogoutRoute)

  app.delete("/realms/:realmId/sessions/:sessionId", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionRevoke({
        database: options.database,
        realmId: context.req.param("realmId"),
        sessionId: context.req.param("sessionId"),
        subjectType: sessionSubjectTypeGet(context.get("authorizationActor")),
        userId: context.get("authorizationActor").actorId,
      }),
    ),
  )

  app.delete("/realms/:realmId/users/:userId/sessions/:sessionId", protectedMiddleware, (context) =>
    sessionResultResponseCreate(
      context,
      sessionAdministratorRevoke({
        actor: context.get("authorizationActor"),
        database: options.database,
        realmId: context.req.param("realmId"),
        sessionId: context.req.param("sessionId"),
        userId: context.req.param("userId"),
      }),
    ),
  )

  app.delete("/realms/:realmId/me/sessions/:sessionId", protectedMiddleware, (context) => {
    const subject = sessionMeSubjectResolve(context, context.req.param("realmId"))
    if (!subject.success) return sessionErrorResponseCreate(context, subject)
    if (context.req.param("sessionId") === subject.data.currentSessionId)
      return sessionErrorResponseCreate(context, {
        code: "sessions.forbidden",
        errorMessage: "The current session must be preserved.",
        op: "sessionMeRevoke",
        success: false,
      })
    return sessionResultResponseCreate(
      context,
      sessionRevoke({
        database: options.database,
        realmId: context.req.param("realmId"),
        sessionId: context.req.param("sessionId"),
        subjectType: "user",
        userId: subject.data.userId,
      }),
    )
  })

  app.delete("/realms/:realmId/sessions", protectedMiddleware, async (context) => {
    const body = await sessionRevokeAllBodyRead(context)
    if (!body.success) return sessionErrorResponseCreate(context, body)
    return sessionResultResponseCreate(
      context,
      sessionRevokeAll({
        database: options.database,
        exceptSessionId: body.data.keepCurrent ? context.get("session").id : undefined,
        realmId: context.req.param("realmId"),
        subjectType: sessionSubjectTypeGet(context.get("authorizationActor")),
        userId: context.get("authorizationActor").actorId,
      }),
    )
  })

  app.delete("/realms/:realmId/me/sessions", protectedMiddleware, (context) => {
    const subject = sessionMeSubjectResolve(context, context.req.param("realmId"))
    if (!subject.success) return sessionErrorResponseCreate(context, subject)
    return sessionResultResponseCreate(
      context,
      sessionRevokeAll({
        database: options.database,
        exceptSessionId: subject.data.currentSessionId,
        realmId: context.req.param("realmId"),
        subjectType: "user",
        userId: subject.data.userId,
      }),
    )
  })

  app.get("/realms/:realmId/protected", protectedMiddleware, (context) =>
    context.json({ actor: context.get("authorizationActor"), session: context.get("session") }),
  )

  return app
}

function sessionListRoute(context: SessionRouteContext, database: StorageDatabase) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return sessionErrorResponseCreate(context, query)
  return sessionResultResponseCreate(
    context,
    sessionList({
      currentSessionId: context.get("session").id,
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      subjectType: sessionSubjectTypeGet(context.get("authorizationActor")),
      userId: context.get("authorizationActor").actorId,
    }),
  )
}

function sessionCurrentRoute(context: SessionRouteContext, database: StorageDatabase) {
  const session = sessionRepositoryCreate(database.db).sessionGet(
    context.req.param("realmId"),
    context.get("session").id,
  )
  if (!session.success) return sessionErrorResponseCreate(context, session)
  if (session.data === null)
    return sessionErrorResponseCreate(context, {
      code: "sessions.unauthorized",
      errorMessage: "The current session could not be found.",
      op: "sessionCurrent",
      success: false,
    })
  return sessionResultResponseCreate(context, {
    data: { session: sessionPublicViewCreate(session.data, true) },
    success: true,
  })
}

function sessionAdministratorListRoute(context: SessionRouteContext, database: StorageDatabase) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return sessionErrorResponseCreate(context, query)
  return sessionResultResponseCreate(
    context,
    sessionAdministratorList({
      actor: context.get("authorizationActor"),
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      userId: context.req.param("userId"),
    }),
  )
}

function sessionRecentListRoute(context: SessionRouteContext, database: StorageDatabase) {
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return sessionErrorResponseCreate(context, query)
  return sessionResultResponseCreate(
    context,
    sessionRecentList({
      currentSessionId: context.get("session").id,
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      subjectType: sessionSubjectTypeGet(context.get("authorizationActor")),
      userId: context.get("authorizationActor").actorId,
    }),
  )
}

function sessionMeListRoute(context: SessionRouteContext, database: StorageDatabase) {
  const subject = sessionMeSubjectResolve(context, context.req.param("realmId"))
  if (!subject.success) return sessionErrorResponseCreate(context, subject)
  const query = listQueryFromSearchParams(context.req.query())
  if (!query.success) return sessionErrorResponseCreate(context, query)
  return sessionResultResponseCreate(
    context,
    sessionMeList({
      currentSessionId: subject.data.currentSessionId,
      database,
      query: query.data,
      realmId: context.req.param("realmId"),
      userId: subject.data.userId,
    }),
  )
}

function sessionRotateRoute(context: SessionRouteContext, database: StorageDatabase) {
  const rotated = sessionRotate({
    database,
    realmId: context.req.param("realmId"),
    token: context.get("cookieAuthenticated")
      ? sessionBrowserCookieTokenGet(context.req.header("cookie"))
      : sessionBearerTokenGet(context.req.header("authorization")),
  })
  if (!rotated.success) return sessionErrorResponseCreate(context, rotated)
  if (!context.get("cookieAuthenticated")) return sessionResultResponseCreate(context, rotated)
  const serialized = sessionBrowserCookieSerialize("session", rotated.data.token)
  if (!serialized.success) return sessionErrorResponseCreate(context, serialized)
  context.header("set-cookie", serialized.data)
  return sessionResultResponseCreate(context, {
    data: { session: rotated.data.session },
    success: true,
  })
}

function sessionBearerTokenGet(authorization: string | undefined): string {
  if (authorization === undefined) return ""
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? ""
}

function sessionMeSubjectResolve(
  context: SessionRouteContext,
  realmId: string,
): Result<{ currentSessionId: string; userId: string }> {
  const actor = context.get("authorizationActor")
  const session = context.get("session")
  if (
    actor.kind !== "user" ||
    actor.realmId !== realmId ||
    session.realmId !== realmId ||
    session.subjectType !== "user" ||
    session.subjectId !== actor.actorId
  )
    return {
      code: "sessions.forbidden",
      errorMessage: "The authenticated user is not available in this realm.",
      op: "sessionMeSubjectResolve",
      success: false,
    }
  return { data: { currentSessionId: session.id, userId: actor.actorId }, success: true }
}

function sessionSubjectTypeGet(actor: AuthorizationActorContext): SessionSubjectType {
  return actor.kind === "bootstrap_admin" ? "bootstrap_admin" : "user"
}

function sessionTenantContextResolve(database: StorageDatabase, host: string | undefined, requestUrl: string) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : (resolvedHost.split(":")[0] ?? "")
  return realmTenantContextResolve({ database, host: normalizedHost })
}

function sessionDeviceMetadataGet(context: {
  readonly req: { readonly header: (name: string) => string | undefined }
}): SessionDeviceMetadata {
  const forwardedFor = context.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim()
  return {
    ...(context.req.header("user-agent") === undefined ? {} : { userAgent: context.req.header("user-agent") }),
    ...(forwardedFor === undefined || forwardedFor.length === 0 ? {} : { ipAddress: forwardedFor }),
    ...(context.req.header("x-device-fingerprint") === undefined
      ? {}
      : { fingerprint: context.req.header("x-device-fingerprint") }),
    ...(context.req.header("x-device-description") === undefined
      ? {}
      : { description: context.req.header("x-device-description") }),
  }
}

async function sessionRequestJsonRead(context: { readonly req: { readonly json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "sessions.invalid",
      errorMessage: "The request body is invalid.",
      op: "sessionRequestJsonRead",
      success: false as const,
    }
  }
}

async function sessionRevokeAllBodyRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    const raw = await context.req.json<unknown>()
    const parsed = v.safeParse(sessionRevokeAllRequestSchema, raw)
    if (!parsed.success)
      return {
        code: "sessions.invalid",
        errorMessage: "The session revocation request is invalid.",
        op: "sessionRevokeAllBodyRead",
        success: false as const,
      }
    return { data: parsed.output, success: true as const }
  } catch (_error) {
    return { data: {}, success: true as const }
  }
}

function sessionErrorResponseCreate(
  context: SessionRouteContext,
  result: { errorMessage: string; op: string; code?: string; success: false },
) {
  return httpResultResponseCreate(context, result as Result<unknown>)
}

function sessionResultResponseCreate<T>(
  context: SessionRouteContext,
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return sessionErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status)
}

type SessionRouteContext = {
  readonly get: {
    (key: "authorizationActor"): AuthorizationActorContext
    (key: "cookieAuthenticated"): boolean
    (key: "session"): Session
  }
  readonly header: (name: string, value: string) => void
  readonly json: (body: unknown, status?: number) => Response
  readonly req: {
    readonly header: (name: string) => string | undefined
    readonly param: (name: string) => string
    readonly query: () => Record<string, string>
    readonly raw: Request
    readonly url: string
  }
}
