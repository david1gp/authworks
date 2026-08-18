import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import * as v from "valibot"
import { httpErrorResponseCreate } from "../../../platform/http/httpErrorResponseCreate.js"
import { httpErrorStatusGet } from "../../../platform/http/httpErrorStatusGet.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmBootstrapAdminAuthenticate } from "../../realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmTenantContextResolve } from "../../realms/actions/realmTenantContextResolve.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../actions/userCreate.js"
import { userDelete } from "../actions/userDelete.js"
import { userEmailVerificationSet } from "../actions/userEmailVerificationSet.js"
import { userGet } from "../actions/userGet.js"
import { userLifecycleSet } from "../actions/userLifecycleSet.js"
import { userList } from "../actions/userList.js"
import { userProfileUpdate } from "../actions/userProfileUpdate.js"
import { userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import { userLifecycleRequestSchema } from "../public/userLifecycleRequestSchema.js"
import { userProfileUpdateRequestSchema } from "../public/userProfileUpdateRequestSchema.js"
import { userVerificationRequestSchema } from "../public/userVerificationRequestSchema.js"

type UserServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly systemSecret?: Secret | string
}

export function userServerAppCreate(options: UserServerAppCreateOptions) {
  const app = new Hono()
  const systemContext = realmSystemContextCreate("system")

  app.get("/system/realms/:realmId/users", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    return userResultResponseCreate(
      context,
      userList({ context: systemContext, database: options.database, realmId: context.req.param("realmId") }),
    )
  })

  app.post("/system/realms/:realmId/users", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userCreateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, { errorMessage: "The user request is invalid.", op: "userCreate" })
    return userResultResponseCreate(
      context,
      userCreate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/system/realms/:realmId/users/:userId", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    return userResultResponseCreate(
      context,
      userGet({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.patch("/system/realms/:realmId/users/:userId/profile", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userProfileUpdateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user profile update is invalid.",
        op: "userProfileUpdate",
      })
    return userResultResponseCreate(
      context,
      userProfileUpdate({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/users/:userId/lifecycle", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userLifecycleRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user lifecycle request is invalid.",
        op: "userLifecycleSet",
      })
    return userResultResponseCreate(
      context,
      userLifecycleSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/system/realms/:realmId/users/:userId/verification", async (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userVerificationRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user verification request is invalid.",
        op: "userEmailVerificationSet",
      })
    return userResultResponseCreate(
      context,
      userEmailVerificationSet({
        context: systemContext,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.delete("/system/realms/:realmId/users/:userId", (context) => {
    const authorization = userSystemAuthorizationGet(context.req.header("authorization"), options.systemSecret)
    if (!authorization.success) return userErrorResponseCreate(context, authorization)
    return userResultResponseCreate(
      context,
      userDelete({
        context: systemContext,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.get("/realms/:realmId/users", (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    return userResultResponseCreate(
      context,
      userList({
        context: authenticated.data,
        database: options.database,
        realmId: context.req.param("realmId"),
      }),
    )
  })

  app.post("/realms/:realmId/users", async (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userCreateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, { errorMessage: "The user request is invalid.", op: "userCreate" })
    return userResultResponseCreate(
      context,
      userCreate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
      }),
      201,
    )
  })

  app.get("/realms/:realmId/users/:userId", (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    return userResultResponseCreate(
      context,
      userGet({
        context: authenticated.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.patch("/realms/:realmId/users/:userId/profile", async (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userProfileUpdateRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user profile update is invalid.",
        op: "userProfileUpdate",
      })
    return userResultResponseCreate(
      context,
      userProfileUpdate({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/realms/:realmId/users/:userId/lifecycle", async (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userLifecycleRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user lifecycle request is invalid.",
        op: "userLifecycleSet",
      })
    return userResultResponseCreate(
      context,
      userLifecycleSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.post("/realms/:realmId/users/:userId/verification", async (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    const body = await userRequestJsonRead(context)
    if (!body.success) return userErrorResponseCreate(context, body)
    const input = v.safeParse(userVerificationRequestSchema, body.data)
    if (!input.success)
      return userErrorResponseCreate(context, {
        errorMessage: "The user verification request is invalid.",
        op: "userEmailVerificationSet",
      })
    return userResultResponseCreate(
      context,
      userEmailVerificationSet({
        context: authenticated.data,
        database: options.database,
        input: input.output,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  app.delete("/realms/:realmId/users/:userId", (context) => {
    const authenticated = userTenantAuthenticate(
      options.database,
      context.req.header("host"),
      context.req.url,
      context.req.header("authorization"),
    )
    if (!authenticated.success) return userErrorResponseCreate(context, authenticated)
    return userResultResponseCreate(
      context,
      userDelete({
        context: authenticated.data,
        database: options.database,
        realmId: context.req.param("realmId"),
        userId: context.req.param("userId"),
      }),
    )
  })

  return app
}

function userErrorResponseCreate(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { errorMessage: string; op: string },
) {
  const code = userErrorCodeGet(result)
  return context.json(
    httpErrorResponseCreate(code, result.errorMessage),
    httpErrorStatusGet(code) as ContentfulStatusCode,
  )
}

function userErrorCodeGet(result: { errorMessage: string; op: string }): string {
  const message = result.errorMessage.toLowerCase()
  if (result.op.includes("Authorization") || result.op.includes("Authenticate") || message.includes("authorization"))
    return "unauthorized"
  if (message.includes("not available") || message.includes("not found")) return "not_found"
  if (message.includes("already") || message.includes("transition") || message.includes("not active")) return "conflict"
  if (message.includes("invalid") || message.includes("empty") || message.includes("required")) return "bad_request"
  return "internal_server_error"
}

function userResultResponseCreate<T>(
  context: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  result: { data?: T; errorMessage?: string; op?: string; success: boolean },
  status = 200,
) {
  if (!result.success) return userErrorResponseCreate(context, result as { errorMessage: string; op: string })
  return context.json(result.data, status as ContentfulStatusCode)
}

async function userRequestJsonRead(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return { data: await context.req.json<unknown>(), success: true as const }
  } catch (_error) {
    return { errorMessage: "The request body is invalid.", op: "userRequestJsonRead", success: false as const }
  }
}

function userSystemAuthorizationGet(authorization: string | undefined, configuredSecret: Secret | string | undefined) {
  const token = userBearerTokenGet(authorization)
  if (configuredSecret === undefined || token === null || !secretMatches(token, configuredSecret))
    return {
      errorMessage: "System authorization is required.",
      op: "userSystemAuthorizationGet",
      success: false as const,
    }
  return { data: undefined, success: true as const }
}

function userTenantAuthenticate(
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
  return realmBootstrapAdminAuthenticate({
    context: tenant.data,
    database,
    secret: userBearerTokenGet(authorization) ?? "",
  })
}

function userBearerTokenGet(authorization: string | undefined): string | null {
  if (authorization === undefined) return null
  const match = /^Bearer (.+)$/.exec(authorization)
  return match?.[1] ?? null
}
