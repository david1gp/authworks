import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import { eventExport } from "../actions/eventExport.js"
import { eventList } from "../actions/eventList.js"
import { eventListQuerySchema, type EventListQuery } from "../public/eventListQuerySchema.js"

type EventServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly systemSecret?: Secret | string
}

type EventServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    cookieAuthenticated: boolean
    session: Session
  }
}

export function eventServerAppCreate(options: EventServerAppCreateOptions) {
  const app = new Hono<EventServerEnv>()
  const systemContext = realmSystemContextCreate("system")
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })

  app.get("/system/realms/:realmId/events", (context) => {
    const authorization = eventSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return eventErrorResponseCreate(context, authorization)
    const query = eventListQueryFromUrl(context.req.url)
    if (!query.success) return eventErrorResponseCreate(context, query)
    return eventResultResponseCreate(
      context,
      eventList({
        context: systemContext,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get("/system/realms/:realmId/events/export", (context) => {
    const authorization = eventSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return eventErrorResponseCreate(context, authorization)
    const query = eventListQueryFromUrl(context.req.url)
    if (!query.success) return eventErrorResponseCreate(context, query)
    return eventResultResponseCreate(
      context,
      eventExport({
        context: systemContext,
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.get(
    "/realms/:realmId/events",
    async (context, next) => {
      if (context.req.header("authorization") === undefined) return protectedMiddleware(context, next)
      const authenticated = eventBearerAuthenticate(options.database, context)
      if (!authenticated.success) return eventErrorResponseCreate(context, authenticated)
      context.set("authorizationActor", authenticated.data.actor)
      return next()
    },
    (context) => {
      const realmId = context.req.param("realmId")
      const authorized = realmAdministratorContextAuthorize({
        actor: context.get("authorizationActor"),
        database: options.database,
        permission: authorizationPermissionDefinitions.eventRead,
        realmId,
      })
      if (!authorized.success) return eventErrorResponseCreate(context, authorized)
      const query = eventListQueryFromUrl(context.req.url)
      if (!query.success) return eventErrorResponseCreate(context, query)
      return eventResultResponseCreate(
        context,
        eventList({ context: authorized.data, database: options.database, query: query.data, realmId }),
      )
    },
  )

  app.get(
    "/realms/:realmId/events/export",
    async (context, next) => {
      if (context.req.header("authorization") === undefined) return protectedMiddleware(context, next)
      const authenticated = eventBearerAuthenticate(options.database, context)
      if (!authenticated.success) return eventErrorResponseCreate(context, authenticated)
      context.set("authorizationActor", authenticated.data.actor)
      return next()
    },
    (context) => {
      const realmId = context.req.param("realmId")
      const authorized = realmAdministratorContextAuthorize({
        actor: context.get("authorizationActor"),
        database: options.database,
        permission: authorizationPermissionDefinitions.eventRead,
        realmId,
      })
      if (!authorized.success) return eventErrorResponseCreate(context, authorized)
      const query = eventListQueryFromUrl(context.req.url)
      if (!query.success) return eventErrorResponseCreate(context, query)
      return eventResultResponseCreate(
        context,
        eventExport({ context: authorized.data, database: options.database, query: query.data, realmId }),
      )
    },
  )

  return app
}

function eventListQueryFromUrl(url: string): Result<EventListQuery> {
  const params = new URL(url).searchParams
  const base = listQueryFromSearchParams(params)
  if (!base.success) return base
  const filters: Record<string, unknown> = {}
  for (const key of ["actorId", "aggregateId", "aggregateType", "eventType", "userSubjectId"] as const) {
    const value = params.get(key)
    if (value !== null) filters[key] = value
  }
  for (const key of ["occurredFrom", "occurredTo"] as const) {
    const value = params.get(key)
    if (value !== null) filters[key] = value.length === 0 ? value : Number(value)
  }
  const parsed = v.safeParse(eventListQuerySchema, { ...base.data, ...filters })
  if (!parsed.success)
    return resultErrorCodedCreate("eventListQueryFromUrl", "The event query is invalid.", "events.invalid")
  return { data: parsed.output, success: true as const }
}

function eventBearerAuthenticate(
  database: StorageDatabase,
  context: {
    readonly req: {
      readonly header: (name: string) => string | undefined
      readonly param: (name: string) => string
      readonly url: string
    }
  },
): Result<{ actor: AuthorizationActorContext }> {
  const token = eventBearerTokenGet(context.req.header("authorization"))
  if (token === null)
    return {
      code: "events.unauthorized",
      errorMessage: "Tenant authorization is required.",
      op: "eventBearerAuthenticate",
      success: false as const,
    }
  const session = sessionAuthenticate({ database, realmId: context.req.param("realmId"), token })
  if (session.success) return { data: { actor: session.data.actor }, success: true }
  const bootstrap = eventTenantAuthenticate(
    database,
    context.req.header("host"),
    context.req.url,
    context.req.header("authorization"),
  )
  if (bootstrap.success) return { data: { actor: bootstrap.data.actor }, success: true }
  return {
    code: "events.unauthorized",
    errorMessage: "Tenant authorization is required.",
    op: "eventBearerAuthenticate",
    success: false as const,
  }
}

function eventTenantAuthenticate(
  database: StorageDatabase,
  host: string | undefined,
  requestUrl: string,
  authorization: string | undefined,
) {
  const resolvedHost = host ?? new URL(requestUrl).hostname
  const normalizedHost = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0]
  const tenant = realmTenantContextResolve({ database, host: normalizedHost ?? "" })
  if (!tenant.success) return tenant
  const authenticated = realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: eventBearerTokenGet(authorization) ?? "",
  })
  if (!authenticated.success && authenticated.code === "realms.unauthorized")
    return { ...authenticated, code: "events.unauthorized" }
  return authenticated
}

function eventBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function eventErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "events.invalid",
    success: false,
  } as Result<unknown>)
}

function eventResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
) {
  if (!result.success)
    return eventErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status)
}

function eventSystemAuthorizationGet(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = eventBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      code: "events.unauthorized",
      errorMessage: "System authorization is required.",
      op: "eventSystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}
