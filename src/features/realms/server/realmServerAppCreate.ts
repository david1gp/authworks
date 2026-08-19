import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import type { Result } from "#result"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmBootstrapAdminAuthenticate } from "../actions/realmBootstrapAdminAuthenticate.js"
import { realmBootstrapAdminCreate } from "../actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../actions/realmCreate.js"
import { realmGet } from "../actions/realmGet.js"
import { realmList } from "../actions/realmList.js"
import { realmTenantContextResolve } from "../actions/realmTenantContextResolve.js"
import { realmUpdate } from "../actions/realmUpdate.js"
import { realmSystemContextCreate } from "../domain/realmSystemContextCreate.js"
import { realmCreateRequestSchema } from "../public/realmCreateRequestSchema.js"
import { realmUpdateRequestSchema } from "../public/realmUpdateRequestSchema.js"

type RealmServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

export function realmServerAppCreate(options: RealmServerAppCreateOptions) {
  const app = new Hono()

  app.get("/system/realms", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return realmErrorResponseCreate(context, authorization)
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return realmErrorResponseCreate(context, query)
    return realmResultResponseCreate(
      context,
      realmList({ context: realmSystemContextCreate(), database: options.database, query: query.data }),
    )
  })

  app.post("/system/realms", async (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return realmErrorResponseCreate(context, authorization)
    const body = await requestJsonRead(context)
    if (!body.success) return realmErrorResponseCreate(context, body)
    const input = v.safeParse(realmCreateRequestSchema, body.data)
    if (!input.success)
      return realmErrorResponseCreate(context, {
        code: "realms.invalid",
        errorMessage: "The realm request is invalid.",
        op: "realmCreate",
      })
    const result = realmCreate({
      context: realmSystemContextCreate(),
      database: options.database,
      input: input.output,
    })
    return realmResultResponseCreate(context, result, 201)
  })

  app.get("/system/realms/:realmId", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return realmErrorResponseCreate(context, authorization)
    const result = realmGet({
      context: realmSystemContextCreate(),
      database: options.database,
      realmId: context.req.param("realmId"),
    })
    return realmResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.realm.updatedAt) : undefined,
    )
  })

  app.patch("/system/realms/:realmId", async (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return realmErrorResponseCreate(context, authorization)
    const body = await requestJsonRead(context)
    if (!body.success) return realmErrorResponseCreate(context, body)
    const input = v.safeParse(realmUpdateRequestSchema, body.data)
    if (!input.success)
      return realmErrorResponseCreate(context, {
        code: "realms.invalid",
        errorMessage: "The realm update is invalid.",
        op: "realmUpdate",
      })
    return realmResultResponseCreate(
      context,
      realmUpdate({
        context: realmSystemContextCreate(),
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/bootstrap-admin", (context) => {
    const authorization = systemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return realmErrorResponseCreate(context, authorization)
    const result = realmBootstrapAdminCreate({
      context: realmSystemContextCreate(),
      database: options.database,
      realmId: context.req.param("realmId"),
    })
    if (!result.success) return realmErrorResponseCreate(context, result)
    return context.json(
      {
        bootstrapAdmin: {
          adminId: result.data.bootstrapAdmin.adminId,
          secret: result.data.bootstrapAdmin.secret.valueGet(),
        },
        realm: result.data.realm,
      },
      201,
    )
  })

  app.get("/realms/:realmId", (context) => {
    const tenant = tenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return realmErrorResponseCreate(context, tenant)
    const result = realmGet({
      context: tenant.data,
      database: options.database,
      realmId: context.req.param("realmId"),
    })
    return realmResultResponseCreate(
      context,
      result,
      200,
      result.success ? new Date(result.data.realm.updatedAt) : undefined,
    )
  })

  app.patch("/realms/:realmId", async (context) => {
    const tenant = tenantContextResolve(options.database, context.req.header("host"), context.req.url)
    if (!tenant.success) return realmErrorResponseCreate(context, tenant)
    const authenticated = realmBootstrapAdminAuthenticate({
      context: tenant.data,
      database: options.database,
      secret: bearerTokenGet(context.req.header("authorization")) ?? "",
    })
    if (!authenticated.success) return realmErrorResponseCreate(context, authenticated)
    const body = await requestJsonRead(context)
    if (!body.success) return realmErrorResponseCreate(context, body)
    const input = v.safeParse(realmUpdateRequestSchema, body.data)
    if (!input.success)
      return realmErrorResponseCreate(context, {
        code: "realms.invalid",
        errorMessage: "The realm update is invalid.",
        op: "realmUpdate",
      })
    return realmResultResponseCreate(
      context,
      realmUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
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

function realmErrorResponseCreate(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  return httpResultResponseCreate(context, {
    ...result,
    code: result.code ?? "realms.invalid",
    success: false,
  } as Result<unknown>)
}

function realmResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: ContentfulStatusCode) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { data?: T; errorMessage?: string; op?: string; code?: string; success: boolean },
  status = 200,
  lastModified?: Date,
) {
  if (!result.success)
    return realmErrorResponseCreate(
      context,
      result as { errorMessage: string; op: string; code?: string; success: false },
    )
  return httpResultResponseCreate(context, result as Result<T>, status, lastModified)
}

async function requestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return {
      code: "realms.invalid",
      errorMessage: "The request body is invalid.",
      op: "requestJsonRead",
      success: false as const,
    }
  }
}

function systemAuthorizationGet(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = bearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      code: "realms.unauthorized",
      errorMessage: "System authorization is required.",
      op: "systemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function tenantContextResolve(database: StorageDatabase, headerHost: string | undefined, requestUrl: string) {
  const host = headerHost ?? new URL(requestUrl).hostname
  const normalizedHost = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0]
  return realmTenantContextResolve({ database, host: normalizedHost ?? "" })
}
