import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceBootstrapAdminAuthenticate } from "../actions/instanceBootstrapAdminAuthenticate.js"
import { instanceBootstrapAdminCreate } from "../actions/instanceBootstrapAdminCreate.js"
import { instanceCreate } from "../actions/instanceCreate.js"
import { instanceGet } from "../actions/instanceGet.js"
import { instanceList } from "../actions/instanceList.js"
import { instanceTenantContextResolve } from "../actions/instanceTenantContextResolve.js"
import { instanceUpdate } from "../actions/instanceUpdate.js"
import { instanceSystemContextCreate } from "../domain/instanceSystemContextCreate.js"
import { instanceCreateRequestSchema } from "../public/instanceCreateRequestSchema.js"
import { instanceUpdateRequestSchema } from "../public/instanceUpdateRequestSchema.js"

type InstanceServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

export function instanceServerAppCreate(options: InstanceServerAppCreateOptions) {
  const app = new Hono()

  app.get("/system/instances", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return instanceErrorResponseCreate(context, authorization)
    return instanceResultResponseCreate(
      context,
      instanceList({ context: instanceSystemContextCreate(), database: options.database }),
    )
  })

  app.post("/system/instances", async (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return instanceErrorResponseCreate(context, authorization)
    const body = await requestJsonRead(context)
    if (!body.success) return instanceErrorResponseCreate(context, body)
    const input = v.safeParse(instanceCreateRequestSchema, body.data)
    if (!input.success)
      return instanceErrorResponseCreate(context, {
        errorMessage: "The instance request is invalid.",
        op: "instanceCreate",
      })
    const result = instanceCreate({
      context: instanceSystemContextCreate(),
      database: options.database,
      input: input.output,
    })
    return instanceResultResponseCreate(context, result, 201)
  })

  app.get("/system/instances/:instanceId", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return instanceErrorResponseCreate(context, authorization)
    return instanceResultResponseCreate(
      context,
      instanceGet({
        context: instanceSystemContextCreate(),
        database: options.database,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.patch("/system/instances/:instanceId", async (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return instanceErrorResponseCreate(context, authorization)
    const body = await requestJsonRead(context)
    if (!body.success) return instanceErrorResponseCreate(context, body)
    const input = v.safeParse(instanceUpdateRequestSchema, body.data)
    if (!input.success)
      return instanceErrorResponseCreate(context, {
        errorMessage: "The instance update is invalid.",
        op: "instanceUpdate",
      })
    return instanceResultResponseCreate(
      context,
      instanceUpdate({
        context: instanceSystemContextCreate(),
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  app.post("/system/instances/:instanceId/bootstrap-admin", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return instanceErrorResponseCreate(context, authorization)
    const result = instanceBootstrapAdminCreate({
      context: instanceSystemContextCreate(),
      database: options.database,
      instanceId: context.req.param("instanceId"),
    })
    if (!result.success) return instanceErrorResponseCreate(context, result)
    return context.json(
      {
        bootstrapAdmin: {
          adminId: result.data.bootstrapAdmin.adminId,
          secret: result.data.bootstrapAdmin.secret.valueGet(),
        },
        instance: result.data.instance,
      },
      201,
    )
  })

  app.get("/instances/:instanceId", (context) => {
    const tenant = tenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return instanceErrorResponseCreate(context, tenant)
    return instanceResultResponseCreate(
      context,
      instanceGet({ context: tenant.data, database: options.database, instanceId: context.req.param("instanceId") }),
    )
  })

  app.patch("/instances/:instanceId", async (context) => {
    const tenant = tenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return instanceErrorResponseCreate(context, tenant)
    const authenticated = instanceBootstrapAdminAuthenticate({
      context: tenant.data,
      database: options.database,
      secret: bearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authenticated.success) return instanceErrorResponseCreate(context, authenticated)
    const body = await requestJsonRead(context)
    if (!body.success) return instanceErrorResponseCreate(context, body)
    const input = v.safeParse(instanceUpdateRequestSchema, body.data)
    if (!input.success)
      return instanceErrorResponseCreate(context, {
        errorMessage: "The instance update is invalid.",
        op: "instanceUpdate",
      })
    return instanceResultResponseCreate(
      context,
      instanceUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        instanceId: context.req.param("instanceId"),
      }),
    )
  })

  return app
}

function bearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}

function instanceErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = instanceErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function instanceErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  if (
    result.op.includes("Authenticate") ||
    result.op.includes("systemAuthorization") ||
    message.includes("credentials") ||
    message.includes("system authorization") ||
    message.includes("system context")
  )
    return "unauthorized"
  if (message.includes("not found") || message.includes("not available") || message.includes("tenant host"))
    return "not_found"
  if (message.includes("already") || message.includes("exists")) return "conflict"
  if (message.includes("only the system") || message.includes("required")) return "forbidden"
  if (message.includes("invalid") || message.includes("empty") || message.includes("unique")) return "bad_request"
  return "internal_server_error"
}

function instanceResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return instanceErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function requestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "requestJsonRead", success: false as const }
  }
}

function systemAuthorizationGet(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = bearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return { errorMessage: "System authorization is required.", op: "systemAuthorizationGet", success: false as const }
  return { data: undefined, success: true as const }
}

function tenantContextResolve(database: StorageDatabase, headerHost: string | undefined, requestUrl: string) {
  const host = headerHost ?? new URL(requestUrl).hostname
  const normalizedHost = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0]
  return instanceTenantContextResolve({ database, host: normalizedHost ?? "" })
}
