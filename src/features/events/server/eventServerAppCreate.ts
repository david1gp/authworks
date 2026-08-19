import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { eventList } from "../actions/eventList.js"

type EventServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

export function eventServerAppCreate(options: EventServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = realmSystemContextCreate("system")

  app.get("/system/realms/:realmId/events", (context) => {
    const authorization = eventSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return eventErrorResponseCreate(context, authorization)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
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

  app.get("/realms/:realmId/events", (context) => {
    const authenticated = eventTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return eventErrorResponseCreate(context, authenticated)
    const realmId = context.req.param("realmId")
    const authorized = authorizationEnforce({
      actor: authenticated.data.actor,
      realmId,
      permission: authorizationPermissionDefinitions.eventRead,
    })
    if (!authorized.success) return eventErrorResponseCreate(context, authorized)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return eventErrorResponseCreate(context, query)
    return eventResultResponseCreate(
      context,
      eventList({ context: authenticated.data, database: options.database, query: query.data, realmId }),
    )
  })

  return app
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
